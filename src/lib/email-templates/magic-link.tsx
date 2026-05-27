import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { EmailLayout, styles } from './_layout'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <EmailLayout preview={`Seu link de acesso para ${siteName}`}>
    <Heading style={styles.h1}>Seu link de acesso</Heading>
    <Text style={styles.text}>
      Clique no botão abaixo para entrar na sua conta {siteName}. Por segurança,
      este link expira em alguns minutos.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Entrar na ElevPay
    </Button>
    <Text style={styles.hint}>
      Se você não solicitou este link, pode ignorar este email com segurança.
    </Text>
  </EmailLayout>
)

export default MagicLinkEmail
