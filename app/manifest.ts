import type { MetadataRoute } from "next";

/** Lets a phone add CostShield to its home screen and open it full-screen, without the browser bars. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CostShield (simulation)",
    short_name: "CostShield",
    description: "Find the costs that markets move in a small business's books, and see what protecting them would have paid. A simulation with devnet test dollars.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f6f5f0",
    theme_color: "#f6f5f0",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
