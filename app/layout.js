import './globals.css'

export const metadata = {
  title: 'AlterEgo - Estimation Immobilière Gratuite',
  description: 'Estimez votre bien immobilier gratuitement en 3 minutes. Estimation basée sur les données DVF du marché actuel.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}