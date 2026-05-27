import * as React from 'react'
import { Heading, Text } from '@react-email/components'
import { EmailLayout, styles } from './_layout'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({
  token,
}: ReauthenticationEmailProps) => (
  <EmailLayout preview="Seu código de verificação ElevPay">
    <Heading style={styles.h1}>Código de verificação</Heading>
    <Text style={styles.text}>
      Use o código abaixo para confirmar sua identidade na ElevPay:
    </Text>
    <Text style={styles.code}>{token}</Text>
    <Text style={styles.hint}>
      Este código expira em alguns minutos. Se você não solicitou, ignore este
      email — ninguém terá acesso à sua conta sem ele.
    </Text>
  </EmailLayout>
)

export default ReauthenticationEmail
