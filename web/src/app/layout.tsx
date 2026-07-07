import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Galamsey Eye — Illegal Mining Detection & Prediction",
  description:
    "Satellite + community detection and prediction of illegal mining (galamsey) in Ghana's river basins.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
