import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DevPersistenceBanner } from "@/components/layout/DevPersistenceBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Second Teacher",
  description: "Second Teacher web client",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-[family-name:var(--font-geist-sans)] antialiased`}
      >
        <DevPersistenceBanner />
        {children}
      </body>
    </html>
  );
}
