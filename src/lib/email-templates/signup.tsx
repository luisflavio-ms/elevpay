import * as React from 'react'
import { Button, Heading, Link, Text } from '@react-email/components'
import { EmailLayout, styles } from './_layout'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <EmailLayout preview={`Confirme seu email na ${siteName}`}>
    <Heading style={styles.h1}>Bem-vindo à ElevPay 👋</Heading>
    <Text style={styles.text}>
      Recebemos seu cadastro com o email{' '}
      <Link href={`mailto:${recipient}`} style={styles.link}>
        {recipient}
      </Link>
      . Para ativar sua conta e começar a receber pagamentos, confirme seu
      endereço clicando no botão abaixo.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Confirmar meu email
    </Button>
    <Text style={styles.hint}>
      Se você não criou uma conta na ElevPay, pode ignorar este email com
      segurança.
    </Text>
  </EmailLayout>
)

export default SignupEmail
