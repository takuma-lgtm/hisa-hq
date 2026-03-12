import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HISA Matcha CRM",
  description: "Internal CRM for HISA Matcha — lead management, sampling, and recurring orders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
