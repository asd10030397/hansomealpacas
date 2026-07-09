import type { MetadataRoute } from "next";
import { isValidHttpUrl } from "@/lib/links";
import { PROJECT } from "@/content/project";

export default function sitemap(): MetadataRoute.Sitemap {
  const website = PROJECT.website.trim();

  if (!isValidHttpUrl(website)) {
    return [];
  }

  const base = website.replace(/\/$/, "");

  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
