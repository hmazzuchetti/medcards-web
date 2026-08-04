import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MedCards",
    short_name: "MedCards",
    description: "Flashcards de medicina com repetição espaçada",
    start_url: "/",
    display: "standalone",
    background_color: "#16213e",
    theme_color: "#16213e",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
