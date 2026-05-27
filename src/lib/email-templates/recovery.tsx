import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { EmailLayout, styles } from './_layout'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <EmailLayout preview={`Redefina sua senha na ${siteName}`}>
    <Heading style={styles.h1}>Redefinir senha</Heading>
    <Text style={styles.text}>
      Recebemos uma solicitação para redefinir a senha da sua conta {siteName}.
      Clique no botão abaixo para escolher uma nova senha.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Redefinir senha
    </Button>
    <Text style={styles.hint}>
      Por segurança, este link expira em breve. Se você não solicitou a
      redefinição, ignore este email — sua senha continuará a mesma.
    </Text>
  </EmailLayout>
)

export default RecoveryEmail
