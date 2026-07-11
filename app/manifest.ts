import type { MetadataRoute } from "next";
import { ASSETS, PROJECT } from "@/content/project";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PROJECT.metaTitle,
    short_name: PROJECT.name,
    description: PROJECT.metaDescription,
    start_url: "/",
    display: "standalone",
    background_color: PROJECT.themeColor,
    theme_color: PROJECT.themeColor,
    icons: [
      {
        src: ASSETS.favicon32,
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: ASSETS.apple,
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: ASSETS.logo512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
