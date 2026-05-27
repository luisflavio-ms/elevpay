import * as React from 'react'
import { Button, Heading, Link, Text } from '@react-email/components'
import { EmailLayout, styles } from './_layout'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <EmailLayout preview={`Confirme a alteração de email na ${siteName}`}>
    <Heading style={styles.h1}>Confirmar alteração de email</Heading>
    <Text style={styles.text}>
      Você solicitou alterar o email da sua conta {siteName} de{' '}
      <Link href={`mailto:${oldEmail}`} style={styles.link}>
        {oldEmail}
      </Link>{' '}
      para{' '}
      <Link href={`mailto:${newEmail}`} style={styles.link}>
        {newEmail}
      </Link>
      .
    </Text>
    <Text style={styles.text}>
      Clique no botão abaixo para confirmar esta alteração:
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Confirmar novo email
    </Button>
    <Text style={styles.hint}>
      Se você não solicitou esta alteração, proteja sua conta imediatamente
      alterando a senha.
    </Text>
  </EmailLayout>
)

export default EmailChangeEmail
