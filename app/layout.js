import './globals.css'
import CookieConsent from '@/components/CookieConsent'

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://alteregopatrimoine.com'),
  title: 'Estimation immobilière gratuite — AlterEgo Patrimoine',
  description: 'Estimez votre bien immobilier gratuitement en 3 minutes, à partir des ventes réelles (DVF) autour de chez vous. Un conseiller AlterEgo affine ensuite avec vous.',
  icons: { icon: '/brand/logo-alterego-noir.png' },
  openGraph: {
    title: 'Estimation immobilière gratuite — AlterEgo Patrimoine',
    description: 'Une première valeur de votre bien en 3 minutes, basée sur les ventes réelles du quartier.',
    locale: 'fr_FR',
    type: 'website',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FBF8F3',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preload" href="/fonts/bricolage-grotesque-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/instrument-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        {/* Traceurs Google chargés uniquement après accord (bandeau cookies) */}
        <CookieConsent />
      </body>
    </html>
  )
}