import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neural Feed",
  description: "Your own feed curated by AI agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
