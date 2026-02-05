import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Web3Provider } from "@/components/providers/Web3Provider";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Yield Empire | DeFi Idle Tycoon",
  description: "Build DeFi empires with your guild through an idle game where instant, gasless transactions make playing feel like a real game.",
  keywords: ["DeFi", "idle game", "Yellow Network", "ENS", "Web3", "gaming"],
  authors: [{ name: "Yield Empire Team" }],
  openGraph: {
    title: "Yield Empire | DeFi Idle Tycoon",
    description: "Build DeFi empires with your guild. Instant, gasless gameplay powered by Yellow Network.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistMono.variable} antialiased`} suppressHydrationWarning>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
