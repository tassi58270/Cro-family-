/**
 * The real root layout, with <html> and <body>, is `app/[locale]/layout.tsx`:
 * every page lives under a language prefix. This file only exists so that
 * `app/not-found.tsx` and the metadata routes have a parent.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return children;
}
