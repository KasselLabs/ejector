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

export const metadata: Metadata = {
  metadataBase: new URL("https://ejector.kassellabs.io"),
  title: "Ejector - Eject Someone",
  description: "Create an Among Us ejection animation for fun!",
  icons: { icon: ["/favicon.ico", "/favicon.png"] },
  openGraph: {
    type: "website",
    title: "Ejector",
    description: "Create an Among Us ejection animation for fun!",
    url: "https://ejector.kassellabs.io",
    images: [
      {
        url: "https://ejector.kassellabs.io/og-image.png",
        width: 200,
        height: 200,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ejector",
    description: "Create an Among Us ejection animation for fun!",
    images: ["https://ejector.kassellabs.io/twitter-card.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={roboto.variable}>
      <body>
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
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
