import type { routing } from "@/lib/i18n/routing";
import type messages from "@/messages/fr.json";

// Makes locales and interface-text keys type-checked everywhere.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
