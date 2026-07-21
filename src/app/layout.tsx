import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { PaymentProvider } from "@/contexts/PaymentProvider";
import { gaId } from "@/lib/config";

export const metadata: Metadata = {
  title: "Ejector - Eject Someone",
  description:
    "Create your own Among Us ejection GIF or video. Customize the character, texts and download it.",
  openGraph: { images: ["/og-image.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
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
