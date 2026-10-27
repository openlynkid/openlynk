import type { MetadataRoute } from "next";
import { PRIVATE_ROUTES, absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_ROUTES],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
