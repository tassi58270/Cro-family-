"use client";

import { useId, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/design/cn";

const themes = ["system", "light", "dark"] as const;
type ThemeChoice = (typeof themes)[number];

const STORAGE_KEY = "croy:theme";
const EVENT = "croy:theme";

/**
 * Runs in <head> before the first paint, so the chosen theme never flashes.
 * Kept tiny and dependency-free on purpose.
 */
export const themeScript = `try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

function read(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function choose(theme: ThemeChoice) {
  const root = document.documentElement;
  try {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  window.dispatchEvent(new Event(EVENT));
}

/** Automatic (follows the device), light or dark. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const name = useId();
  const current = useSyncExternalStore(subscribe, read, () => "system");

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">{t("label")}</legend>
      <div className="inline-flex rounded-full border border-hairline-strong p-0.5 text-caption font-medium">
        {themes.map((theme) => (
          <label
            key={theme}
            className={cn(
              "relative inline-flex min-h-10 cursor-pointer items-center rounded-full px-3.5 transition-colors duration-(--duration-fast) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-croy",
              current === theme ? "bg-ink text-paper" : "hover:bg-paper-2",
            )}
          >
            <input
              type="radio"
              name={name}
              value={theme}
              checked={current === theme}
              onChange={() => choose(theme)}
              className="sr-only"
            />
            {t(theme)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
