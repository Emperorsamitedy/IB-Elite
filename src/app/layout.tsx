import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, Newsreader, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const grotesk = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-grotesk",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Atlas — IB Revision, reimagined",
    template: "%s · Atlas",
  },
  description:
    "A fast, intelligent IB revision platform. Stop searching for questions — start practising smarter with topic practice, a mistake notebook, and an AI tutor.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    title: "Atlas — IB Revision, reimagined",
    description:
      "Stop searching for questions. Start preparing smarter.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F2EC" },
    { media: "(prefers-color-scheme: dark)", color: "#0C1620" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${grotesk.variable} ${newsreader.variable} ${plexMono.variable}`}
    >
      <body className="min-h-dvh bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
