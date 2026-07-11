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
    {
      url: `${base}/swap`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${base}/token-list`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${base}/transparency`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/token-list/hansome-alpacas-robinhood.tokenlist.json`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
