import type enCommon from "./locales/en/common.json";
import type enNav from "./locales/en/nav.json";
import type enStyleguide from "./locales/en/styleguide.json";
import type enTutor from "./locales/en/tutor.json";
import enCommonJson from "./locales/en/common.json";
import enNavJson from "./locales/en/nav.json";
import enStyleguideJson from "./locales/en/styleguide.json";
import enTutorJson from "./locales/en/tutor.json";
import trCommonJson from "./locales/tr/common.json";
import trNavJson from "./locales/tr/nav.json";
import trStyleguideJson from "./locales/tr/styleguide.json";
import trTutorJson from "./locales/tr/tutor.json";

/** Locale-independent list of supported locales (CLAUDE.md §6). */
export const SUPPORTED_LOCALES = ["en", "tr"] as const;

/** Namespace names shipped so far; later steps add their own (spec §6.1). */
export const NAMESPACES = ["common", "nav", "styleguide", "tutor"] as const;

export const resources = {
  en: { common: enCommonJson, nav: enNavJson, styleguide: enStyleguideJson, tutor: enTutorJson },
  tr: { common: trCommonJson, nav: trNavJson, styleguide: trStyleguideJson, tutor: trTutorJson },
} as const;

/** English resource shape — the source of truth for typed keys. */
export type EnResources = {
  common: typeof enCommon;
  nav: typeof enNav;
  styleguide: typeof enStyleguide;
  tutor: typeof enTutor;
};
