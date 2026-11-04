import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Wave Dash — Neon Wave Game";
const description =
  "One-button neon wave-riding game: hold to glide up, release to dive down, and thread your wave through the gaps. Local best scores, icon kit, pattern editor and daily rewards.";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s — Wave Dash",
  },
  description,
  applicationName: "Wave Dash",
  keywords: [
    "wave dash",
    "canvas game",
    "arcade",
    "one-button game",
    "browser game",
    "wave rider",
  ],
  openGraph: {
    type: "website",
    siteName: "Wave Dash",
    title,
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Wave Dash" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-black" suppressHydrationWarning>{children}</body>
    </html>
  );
}
