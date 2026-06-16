import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./atlas-theme.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AtlasLM  -  Premium AI Knowledge Workspace",
  description: "A self-hosted, source-grounded research notebook for privacy, model freedom, and secure AI workspaces.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-full bg-zinc-950 text-zinc-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}

