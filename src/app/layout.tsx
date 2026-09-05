import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wave Dash",
  description:
    "A high-performance gaming landing page template featuring a built-in canvas game engine, dynamic customization tools, and a futuristic dark visual style.",
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
