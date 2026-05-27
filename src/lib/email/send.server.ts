import * as React from 'react'
import { render } from '@react-email/components'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'ElevPay'
const SENDER_DOMAIN = 'notify.elevpayapp.com.br'
const FROM_DOMAIN = 'notify.elevpayapp.com.br'

interface SendParams {
  templateName: string
  recipientEmail: string
  idempotencyKey: string
  templateData?: Record<string, any>
}

/**
 * Server-side helper to enqueue a transactional email from trusted code
 * (webhooks, cron, server functions). Bypasses the user-JWT-protected
 * /lovable/email/transactional/send route by talking directly to the queue
 * with the service role.
 */
export async function sendTransactionalEmailServer({
  templateName,
  recipientEmail,
  idempotencyKey,
  templateData = {},
}: SendParams): Promise<{ success: boolean; reason?: string; messageId?: string }> {
  const template = TEMPLATES[templateName]
  if (!template) {
    console.error('[email] unknown template', { templateName })
    return { success: false, reason: 'unknown_template' }
  }

  const normalized = recipientEmail.toLowerCase().trim()
  if (!normalized || !normalized.includes('@')) {
    return { success: false, reason: 'invalid_email' }
  }

  // 1. Check suppression list
  const { data: suppressed } = await supabaseAdmin
    .from('suppressed_emails')
    .select('email')
    .eq('email', normalized)
    .maybeSingle()
  if (suppressed) {
    return { success: false, reason: 'email_suppressed' }
  }

  // 2. Idempotency — skip if already enqueued/sent
  const { data: existing } = await supabaseAdmin
    .from('email_send_log')
    .select('message_id')
    .eq('message_id', idempotencyKey)
    .maybeSingle()
  if (existing) {
    return { success: true, reason: 'duplicate', messageId: idempotencyKey }
  }

  // 3. Ensure unsubscribe token exists for this address
  let unsubscribeToken: string | null = null
  const { data: existingToken } = await supabaseAdmin
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalized)
    .maybeSingle()

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    const newToken = crypto.randomUUID().replace(/-/g, '')
    const { data: inserted } = await supabaseAdmin
      .from('email_unsubscribe_tokens')
      .upsert({ email: normalized, token: newToken }, { onConflict: 'email' })
      .select('token')
      .single()
    unsubscribeToken = inserted?.token ?? newToken
  }

  // 4. Render
  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const plainText = await render(element, { plainText: true })
  const subject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  const messageId = idempotencyKey

  // 5. Log + enqueue
  await supabaseAdmin.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: normalized,
    status: 'pending',
  })

  const { error: enqueueError } = await supabaseAdmin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: normalized,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('[email] enqueue failed', { error: enqueueError, messageId })
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: normalized,
      status: 'failed',
      error_message: enqueueError.message,
    })
    return { success: false, reason: 'enqueue_failed' }
  }

  return { success: true, messageId }
}
