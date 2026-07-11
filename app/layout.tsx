import type { Metadata, Viewport } from "next";
import { Anton, Noto_Sans_TC } from "next/font/google";
import { AmbientSound } from "@/components/AmbientSound";
import { Analytics } from "@/components/Analytics";
import { AnalyticsPageView } from "@/components/AnalyticsPageView";
import { LanguageToggle } from "@/components/LanguageToggle";
import { MotionProvider } from "@/components/MotionProvider";
import { SkipLink } from "@/components/SkipLink";
import { LocaleProvider } from "@/context/LocaleContext";
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
  themeColor: PROJECT.themeColor,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

const website = isValidHttpUrl(PROJECT.website) ? PROJECT.website.trim() : undefined;
const canonical = website?.replace(/\/$/, "");
const metadataBase = website ? new URL(website) : new URL("https://kairu.lol");

export const metadata: Metadata = {
  metadataBase,
  title: PROJECT.metaTitle,
  description: PROJECT.metaDescription,
  applicationName: PROJECT.name,
  ...(canonical ? { alternates: { canonical } } : {}),
  openGraph: {
    title: PROJECT.ogTitle,
    description: PROJECT.metaDescription,
    siteName: PROJECT.name,
    type: "website",
    locale: "en_US",
    alternateLocale: ["zh_TW"],
    url: canonical ?? metadataBase.origin,
    images: [
      {
        url: ASSETS.og,
        width: 1200,
        height: 630,
        alt: "UGLY DEER — premium gold coin social preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PROJECT.twitterTitle,
    description: PROJECT.metaDescription,
    site: "@DeerloveRu",
    images: [ASSETS.twitterImage],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: ASSETS.faviconIco, sizes: "any" },
      { url: ASSETS.favicon32, sizes: "32x32", type: "image/png" },
      { url: ASSETS.favicon16, sizes: "16x16", type: "image/png" },
    ],
    apple: { url: ASSETS.apple, sizes: "180x180", type: "image/png" },
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${anton.variable} ${notoSansTC.variable}`}>
      <body className="min-h-screen bg-background antialiased">
        <LocaleProvider>
          <LanguageToggle />
          <SkipLink />
          <AnalyticsPageView />
          <MotionProvider>{children}</MotionProvider>
        </LocaleProvider>
        <AmbientSound />
        <Analytics />
      </body>
    </html>
  );
}
