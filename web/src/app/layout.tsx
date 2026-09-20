import type { Metadata, Viewport } from "next";
import { Inter, Inconsolata } from "next/font/google";
import "./globals.css";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { Providers } from "@/components/providers";

// Stellar Design System typography: Inter (text) + Inconsolata (mono).
// SDS uses a single family and separates roles by weight and letter spacing.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],   // latin-ext covers place names such as Çanakkale
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
    "A social running protocol on Stellar. Earn city badges, join challenges, top up USDC with Turkish Lira.",
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
      lang="en"
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
