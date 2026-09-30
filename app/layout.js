import './globals.css'
import Script from 'next/script'

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
        {/* Google Tag Manager - Doit être le plus haut possible */}
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-MVZ2NFKR');
          `}
        </Script>
        
        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17772583118"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17772583118');
          `}
        </Script>
        
        {/* Event snippet for Estimation effectuée conversion page */}
        <Script id="google-ads-conversion" strategy="afterInteractive">
          {`
            function gtag_report_conversion(url) {
              var callback = function () {
                if (typeof(url) != 'undefined') {
                  window.location = url;
                }
              };
              gtag('event', 'conversion', {
                  'send_to': 'AW-17772583118/Qdm9CNLhnssbEM6x0JpC',
                  'event_callback': callback
              });
              return false;
            }
          `}
        </Script>
      </head>
      <body>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe 
            src="https://www.googletagmanager.com/ns.html?id=GTM-MVZ2NFKR"
            height="0" 
            width="0" 
            style={{display: 'none', visibility: 'hidden'}}
          ></iframe>
        </noscript>
        {children}
      </body>
    </html>
  )
}