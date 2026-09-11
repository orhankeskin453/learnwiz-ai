import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { Locale } from "@learwizai/types";
import { NAMESPACES, resources } from "./resources";

// lng is set per-route by LocaleGate (Task 6); "en" is only the boot default.
void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  ns: [...NAMESPACES],
  interpolation: { escapeValue: false }, // React already escapes
});

/** Active UI locale, normalized to the supported set (§6.4 helper for API calls). */
export function getActiveLocale(): Locale {
  return i18n.language === "tr" ? "tr" : "en";
}

export default i18n;
