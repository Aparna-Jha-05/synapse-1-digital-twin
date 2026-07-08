import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SYNAPSE-1 Digital Twin | SpAr Conclave 2026",
  description: "Operational digital twin of SYNAPSE-1 lunar habitat — Architecture as a Proactive Behavioural Support System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-background text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}

