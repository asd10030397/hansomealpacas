import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import { DownloadPageContent } from "@/components/download/DownloadPageContent";
import { en } from "@/content/i18n/en";
import { PROJECT } from "@/content/project";
import { ANDROID_APK_STABLE_FILENAME } from "@/lib/androidDownload";
import { isValidHttpUrl } from "@/lib/links";

const website = isValidHttpUrl(PROJECT.website)
  ? PROJECT.website.trim().replace(/\/$/, "")
  : "https://hansomealpacas.xyz";
const downloadUrl = `${website}/download`;

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getApkFileSizeLabel(): string {
  const apkPath = path.join(process.cwd(), "public", "downloads", ANDROID_APK_STABLE_FILENAME);
  const bytes = fs.statSync(apkPath).size;
  return formatFileSize(bytes);
}

export const metadata: Metadata = {
  title: en.download.meta.title,
  description: en.download.meta.description,
  alternates: {
    canonical: downloadUrl,
    languages: {
      en: downloadUrl,
      "zh-CN": downloadUrl,
      "x-default": downloadUrl,
    },
  },
  openGraph: {
    title: en.download.meta.title,
    description: en.download.meta.description,
    url: downloadUrl,
    siteName: PROJECT.name,
    type: "website",
    locale: "en_US",
    alternateLocale: ["zh_CN"],
  },
  twitter: {
    card: "summary",
    title: en.download.meta.title,
    description: en.download.meta.description,
  },
};

export default function DownloadPage() {
  const fileSizeLabel = getApkFileSizeLabel();

  return <DownloadPageContent fileSizeLabel={fileSizeLabel} />;
}
