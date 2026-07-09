import type { Metadata, Viewport } from "next";
import { Anton, Noto_Sans_TC } from "next/font/google";
import { Analytics } from "@/components/Analytics";
import { MotionProvider } from "@/components/MotionProvider";
import { ASSETS, PROJECT } from "@/content/project";
import { isValidHttpUrl } from "@/lib/links";
import "@/styles/globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
  preload: true,
});

const notoSansTC = Noto_Sans_TC({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-noto-sans-tc",
  display: "swap",
  preload: true,
});

export const viewport: Viewport = {
  themeColor: "#090909",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

const website = isValidHttpUrl(PROJECT.website) ? PROJECT.website.trim() : undefined;
const title = `${PROJECT.name} | ${PROJECT.chain} Meme Coin`;
const canonical = website?.replace(/\/$/, "");

export const metadata: Metadata = {
  title,
  description: PROJECT.description,
  ...(website ? { metadataBase: new URL(website) } : {}),
  ...(canonical ? { alternates: { canonical } } : {}),
  icons: {
    icon: [
      { url: ASSETS.favicon, sizes: "32x32", type: "image/png" },
      { url: ASSETS.logo512, sizes: "512x512", type: "image/png" },
    ],
    apple: ASSETS.avatar,
  },
  openGraph: {
    title,
    description: PROJECT.description,
    siteName: PROJECT.name,
    type: "website",
    locale: "zh_TW",
    ...(canonical ? { url: canonical } : {}),
    images: [
      {
        url: ASSETS.og,
        width: 1200,
        height: 630,
        alt: `${PROJECT.name} mascot`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: PROJECT.description,
    images: [ASSETS.og],
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={`${anton.variable} ${notoSansTC.variable}`}>
      <body className="min-h-screen bg-background antialiased">
        <a
          href="#about"
          className="sr-only focus:not-sr-only focus:fixed focus:left-6 focus:top-6 focus:z-50 focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:text-foreground"
        >
          Skip to content
        </a>
        <MotionProvider>{children}</MotionProvider>
        <Analytics />
      </body>
    </html>
  );
}
