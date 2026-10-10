/**
 * The palette as values, mirrored from `app/globals.css`, for the style page
 * and for the contrast tests. Keep both in sync.
 */
export const palette = {
  light: {
    paper: "#ffffff",
    paper2: "#f4f4f2",
    ink: "#141414",
    inkMuted: "#5f5f5b",
    hairline: "#e4e4df",
    croy: "#c8102e",
    croyDeep: "#8e0b20",
    croyText: "#c8102e",
  },
  dark: {
    paper: "#141414",
    paper2: "#1e1e1d",
    ink: "#f4f4f2",
    inkMuted: "#a8a8a3",
    hairline: "#2e2e2c",
    croy: "#c8102e",
    croyDeep: "#a50d26",
    croyText: "#ff7a8a",
  },
} as const;

export type Theme = keyof typeof palette;
export type Swatch = keyof (typeof palette)["light"];
