import type { MetadataRoute } from "next";
import { getPublicBranding } from "@/lib/school";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const b = await getPublicBranding();
  return {
    name: b?.nameEn ?? "School Manager",
    short_name: b?.nameEn?.split(" ").slice(0, 2).join(" ") ?? "School",
    description: b?.nameBn ?? "School management",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4F7FB",
    theme_color: b?.primaryColor ?? "#114364",
    lang: "bn",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
