import type { MetadataRoute } from "next";

/** Added to a phone's home screen, the site opens on French, like « / ». */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Maison de Croÿ",
    short_name: "Croÿ",
    start_url: "/fr",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
