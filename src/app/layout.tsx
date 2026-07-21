import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
