import type { Metadata, Viewport } from "next";

import InstallPrompt from "@/components/InstallPrompt";

import "./globals.css";

export const metadata: Metadata = {
  title: "Galamsey Eye — Illegal Mining Detection & Prediction",
  description:
    "Satellite + community detection and prediction of illegal mining (galamsey) in Ghana's river basins.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Galamsey Eye",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
