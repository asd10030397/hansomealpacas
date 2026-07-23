import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { ASSETS, PROJECT } from "@/content/project";
import { buildGameManifest } from "@/lib/pwa/gameManifest";
import { isGameHostHostname } from "@/lib/game/paths";

/** Marketing-site manifest (hansomealpacas.xyz / www). */
function marketingManifest(): MetadataRoute.Manifest {
  return {
    name: PROJECT.metaTitle,
    short_name: PROJECT.name,
    description: PROJECT.metaDescription,
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "en",
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
        purpose: "any",
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

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const host = (await headers()).get("host");
  if (isGameHostHostname(host)) {
    return buildGameManifest();
  }
  return marketingManifest();
}
