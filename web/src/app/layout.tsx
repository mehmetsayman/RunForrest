import type { Metadata, Viewport } from "next";
import { Inter, Inconsolata } from "next/font/google";
import "./globals.css";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { Providers } from "@/components/providers";

// Stellar Design System tipografisi: Inter (metin) + Inconsolata (mono).
// SDS tek aile kullanıyor; ayrımı ağırlık ve harf aralığıyla yapıyor.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],   // latin-ext: Türkçe ş ğ ı İ ç ö ü
  display: "swap",
});

const inconsolata = Inconsolata({
  variable: "--font-inconsolata",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description:
    "Stellar üzerinde sosyal koşu protokolü. Şehir rozetleri kazan, yarışmalara katıl, TRY ile USDC yükle.",
  applicationName: APP_NAME,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  icons: {
    icon: "/icon-512.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#fdda24",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`dark ${inter.variable} ${inconsolata.variable} h-full`}
    >
      <body
        className="min-h-full font-sans antialiased"
        style={
          {
            "--font-sans": "var(--font-inter), system-ui, sans-serif",
          } as React.CSSProperties
        }
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
