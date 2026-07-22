import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { PaymentProvider } from "@/contexts/PaymentProvider";
import { gaId } from "@/lib/config";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

const SITE_URL = "https://ejector.kassellabs.io";

const DESCRIPTION =
  "Create your own Among Us ejection animation. Type the ejection text, pick a crewmate colour or upload your own image, then download a free GIF or an HD video.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Ejector - Eject Someone",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // Icons come from the App Router file conventions (src/app/favicon.ico,
  // icon.png, apple-icon.png) -- no manual `icons` entry needed.
  openGraph: {
    type: "website",
    title: "Ejector",
    description: DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ejector — create your own Among Us ejection animation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ejector",
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#webapplication`,
      name: "Ejector",
      alternateName: "Ejector - Eject Someone",
      description: DESCRIPTION,
      url: `${SITE_URL}/`,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web browser",
      image: `${SITE_URL}/og-image.png`,
      inLanguage: ["en", "pt-BR"],
      offers: [
        {
          "@type": "Offer",
          name: "Free GIF export (watermarked)",
          price: "0.00",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          name: "HD MP4 export (1280x720, watermarked)",
          price: "3.00",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          name: "Full HD MP4 export (1920x1080, no watermark)",
          price: "5.00",
          priceCurrency: "USD",
        },
      ],
      publisher: { "@id": "https://kassellabs.io/#organization" },
    },
    {
      "@type": "Organization",
      "@id": "https://kassellabs.io/#organization",
      name: "Kassel Labs",
      url: "https://kassellabs.io",
      logo: {
        "@type": "ImageObject",
        url: "https://kassellabs.io/images/icons/icon-512x512.png",
      },
      sameAs: [
        "https://www.instagram.com/kassellabs",
        "https://www.facebook.com/KasselLabs/",
        "https://www.tiktok.com/@kassellabs",
        "https://x.com/KasselLabs",
        "https://www.youtube.com/@KasselLabsVideos",
        "https://github.com/KasselLabs",
        "https://www.linkedin.com/company/kassellabs",
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={roboto.variable}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="lazyOnload"
            />
            <Script id="ga-init" strategy="lazyOnload">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
        <I18nProvider>
          <PaymentProvider>{children}</PaymentProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
