import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { EmailLayout, styles } from './_layout'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  confirmationUrl,
}: InviteEmailProps) => (
  <EmailLayout preview={`Você foi convidado para a ${siteName}`}>
    <Heading style={styles.h1}>Você recebeu um convite 🎉</Heading>
    <Text style={styles.text}>
      Você foi convidado para fazer parte da {siteName}. Clique no botão abaixo
      para aceitar o convite e criar sua conta.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Aceitar convite
    </Button>
    <Text style={styles.hint}>
      Se você não esperava este convite, pode ignorar este email com segurança.
    </Text>
  </EmailLayout>
)

export default InviteEmail
