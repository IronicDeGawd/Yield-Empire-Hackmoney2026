import type { Metadata } from "next";
import { Geist_Mono, Press_Start_2P, VT323 } from "next/font/google";
import { Web3Provider } from "@/components/providers/Web3Provider";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pressStart2P = Press_Start_2P({
  weight: "400",
  variable: "--font-pixel",
  subsets: ["latin"],
});

const vt323 = VT323({
  weight: "400",
  variable: "--font-retro",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Yield Empire | DeFi Idle Tycoon",
  description: "Build DeFi empires with your guild through an idle game where instant, gasless transactions make playing feel like a real game.",
  keywords: ["DeFi", "idle game", "Yellow Network", "ENS", "Web3", "gaming"],
  authors: [{ name: "Yield Empire Team" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
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
      <head>
        {/* Suppress browser extension errors (e.g. MetaMask "Cannot set property ethereum")
            that trigger the Next.js error overlay in dev mode */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                window.addEventListener('error', function(e) {
                  if (e.filename && e.filename.startsWith('chrome-extension://')) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                  }
                }, true);
              }
            `,
          }}
        />
      </head>
      <body className={`${geistMono.variable} ${pressStart2P.variable} ${vt323.variable} antialiased`} suppressHydrationWarning>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-100 focus:top-4 focus:left-4 focus:bg-purple-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg">
          Skip to main content
        </a>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
