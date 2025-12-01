import './globals.css'
import Script from 'next/script'

export const metadata = {
  title: 'AlterEgo - Estimation Immobilière Gratuite',
  description: 'Estimez votre bien immobilier gratuitement en 3 minutes. Estimation basée sur les données DVF du marché actuel.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17772210097"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17772210097');
          `}
        </Script>
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}