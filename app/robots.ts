import type { MetadataRoute } from "next";
import { isValidHttpUrl } from "@/lib/links";
import { PROJECT } from "@/content/project";

export default function robots(): MetadataRoute.Robots {
  const website = PROJECT.website.trim();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    ...(isValidHttpUrl(website) ? { sitemap: `${website.replace(/\/$/, "")}/sitemap.xml` } : {}),
  };
}
