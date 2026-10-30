import React from 'react'
import type { Metadata } from 'next'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
import './styles.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cormorant',
})

const title = 'Concours Authentique Homme | Ministère Porteur d’Amour'
const description =
  'AUTHENTIQUE HOMME — La Parole de Dieu face aux réalités de l’homme. Concours de réflexion biblique des 3 Jours de Reconnaissance 2026 : inscriptions, sujet, étapes et récompenses.'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title,
  description,
  openGraph: {
    title,
    description,
    images: ['/organs/authentique-homme.png'],
    locale: 'fr_FR',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${manrope.variable} ${cormorant.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen bg-white text-ink antialiased">{children}</body>
    </html>
  )
}
