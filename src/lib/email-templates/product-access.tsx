import * as React from 'react'
import { Button, Heading, Section, Text } from '@react-email/components'
import { EmailLayout, styles } from './_layout'
import type { TemplateEntry } from './registry'

interface ProductAccessEmailProps {
  customerName?: string
  productName?: string
  accessUrl?: string
  orderId?: string
  amount?: string
}

const ProductAccessEmail = ({
  customerName,
  productName = 'seu produto',
  accessUrl = '#',
  orderId,
  amount,
}: ProductAccessEmailProps) => (
  <EmailLayout preview={`Acesso liberado: ${productName}`}>
    <Heading style={styles.h1}>Acesso liberado! 🎉</Heading>
    <Text style={styles.text}>
      {customerName ? `Olá, ${customerName}!` : 'Olá!'} Recebemos a confirmação
      do seu pagamento e seu acesso a <strong>{productName}</strong> já está
      liberado.
    </Text>
    <Text style={styles.text}>
      Clique no botão abaixo para acessar agora mesmo:
    </Text>
    <Button style={styles.button} href={accessUrl}>
      Acessar meu produto
    </Button>

    {(orderId || amount) && (
      <Section style={infoBox}>
        <Text style={infoTitle}>Resumo do pedido</Text>
        {orderId && (
          <Text style={infoRow}>
            <span style={infoLabel}>Pedido:</span>{' '}
            <span style={infoValue}>#{orderId.slice(0, 8).toUpperCase()}</span>
          </Text>
        )}
        {amount && (
          <Text style={infoRow}>
            <span style={infoLabel}>Valor pago:</span>{' '}
            <span style={infoValue}>{amount}</span>
          </Text>
        )}
        <Text style={infoRow}>
          <span style={infoLabel}>Produto:</span>{' '}
          <span style={infoValue}>{productName}</span>
        </Text>
      </Section>
    )}

    <Text style={styles.hint}>
      Guarde este email — ele é seu comprovante de acesso. Se tiver qualquer
      dúvida, basta responder a este email que ajudamos você. Obrigado pela
      confiança!
    </Text>
  </EmailLayout>
)

export const template = {
  component: ProductAccessEmail,
  subject: (data: Record<string, any>) =>
    `Acesso liberado: ${data?.productName ?? 'seu produto'}`,
  displayName: 'Liberação de acesso pós-compra',
  previewData: {
    customerName: 'Maria',
    productName: 'Curso de Marketing Digital',
    accessUrl: 'https://exemplo.com/acesso',
    orderId: 'a1b2c3d4e5f6',
    amount: 'R$ 197,00',
  },
} satisfies TemplateEntry

export default ProductAccessEmail

const infoBox = {
  backgroundColor: '#f5f0ff',
  border: '1px solid #e4d6ff',
  borderRadius: '10px',
  padding: '16px 20px',
  margin: '8px 0 24px',
}
const infoTitle = {
  fontSize: '12px',
  fontWeight: 700 as const,
  color: '#7c3aed',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 10px',
}
const infoRow = {
  fontSize: '14px',
  color: '#3f3a52',
  margin: '0 0 6px',
  lineHeight: '1.5',
}
const infoLabel = { color: '#8a8597' }
const infoValue = { color: '#0f0a1f', fontWeight: 600 as const }
