import type { MetadataRoute } from "next";
import { ASSETS, PROJECT } from "@/content/project";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PROJECT.name,
    short_name: PROJECT.name,
    description: PROJECT.description,
    start_url: "/",
    display: "standalone",
    background_color: "#090909",
    theme_color: "#090909",
    icons: [
      {
        src: ASSETS.favicon,
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: ASSETS.logo512,
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
