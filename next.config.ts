import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
    {
      source: "/logo/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
    {
      source: "/images/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
    {
      source: "/icons/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
    {
      source: "/assets/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
    {
      source: "/token-list/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
    },
    {
      source: "/docs/:path*.pdf",
      headers: [
        { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        { key: "Content-Type", value: "application/pdf" },
      ],
    },
    {
      source: "/docs/:path*.md",
      headers: [
        { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        { key: "Content-Type", value: "text/markdown; charset=utf-8" },
      ],
    },
    {
      source: "/downloads/:path*.apk",
      headers: [
        { key: "Cache-Control", value: "public, max-age=300, must-revalidate" },
        { key: "Content-Type", value: "application/vnd.android.package-archive" },
      ],
    },
  ],
};

export default nextConfig;
