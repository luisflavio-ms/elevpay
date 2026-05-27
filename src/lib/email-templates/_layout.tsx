import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface LayoutProps {
  preview: string
  children: React.ReactNode
}

export const EmailLayout = ({ preview, children }: LayoutProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>
            Elev<span style={brandAccent}>Pay</span>
          </Text>
        </Section>
        <Section style={card}>{children}</Section>
        <Hr style={hr} />
        <Text style={footer}>
          © {new Date().getFullYear()} ElevPay. Todos os direitos reservados.
        </Text>
        <Text style={footerSmall}>
          Este é um email automático, não responda a esta mensagem.
        </Text>
      </Container>
    </Body>
  </Html>
)

// Shared brand styles — email-safe (inline, hex, system fonts)
export const styles = {
  h1: {
    fontSize: '24px',
    fontWeight: 700 as const,
    color: '#0f0a1f',
    margin: '0 0 16px',
    lineHeight: '1.3',
  },
  text: {
    fontSize: '15px',
    color: '#3f3a52',
    lineHeight: '1.6',
    margin: '0 0 20px',
  },
  button: {
    backgroundColor: '#7c3aed',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600 as const,
    borderRadius: '10px',
    padding: '14px 28px',
    textDecoration: 'none',
    display: 'inline-block',
    boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
  },
  link: { color: '#7c3aed', textDecoration: 'underline' },
  code: {
    display: 'inline-block',
    fontFamily: '"SF Mono", Menlo, Consolas, monospace',
    fontSize: '28px',
    fontWeight: 700 as const,
    color: '#7c3aed',
    letterSpacing: '6px',
    backgroundColor: '#f5f0ff',
    border: '1px solid #e4d6ff',
    borderRadius: '10px',
    padding: '16px 24px',
    margin: '8px 0 24px',
  },
  hint: {
    fontSize: '13px',
    color: '#8a8597',
    lineHeight: '1.5',
    margin: '24px 0 0',
  },
}

const main = {
  backgroundColor: '#f5f3fa',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: '32px 0',
}
const container = { maxWidth: '560px', margin: '0 auto', padding: '0 16px' }
const header = { padding: '0 0 20px', textAlign: 'center' as const }
const brand = {
  fontSize: '24px',
  fontWeight: 800 as const,
  color: '#0f0a1f',
  margin: 0,
  letterSpacing: '-0.5px',
}
const brandAccent = { color: '#7c3aed' }
const card = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '40px 32px',
  border: '1px solid #ece8f5',
}
const hr = {
  borderColor: '#ece8f5',
  margin: '28px 0 16px',
}
const footer = {
  fontSize: '12px',
  color: '#8a8597',
  textAlign: 'center' as const,
  margin: '0 0 4px',
}
const footerSmall = {
  fontSize: '11px',
  color: '#a8a4b5',
  textAlign: 'center' as const,
  margin: 0,
}
