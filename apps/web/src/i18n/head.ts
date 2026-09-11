import type { Locale } from "@learwizai/types";
import { SUPPORTED_LOCALES } from "./resources";

const MARKER = "data-i18n-head";

function withLocale(pathname: string, locale: Locale): string {
  const rest = pathname.replace(/^\/(?:en|tr)(?=\/|$)/, "");
  return `/${locale}${rest}`;
}

/**
 * Replace hreflang alternates + canonical to match the active locale/route.
 * Baseline SEO for the SPA route model (§31); prerendering lands later.
 */
export function syncHreflang(locale: Locale): void {
  const head = document.head;
  head.querySelectorAll(`link[${MARKER}]`).forEach((el) => el.remove());

  const { origin, pathname, search } = window.location;
  for (const target of SUPPORTED_LOCALES) {
    const link = document.createElement("link");
    link.rel = "alternate";
    link.hreflang = target;
    link.href = `${origin}${withLocale(pathname, target)}${search}`;
    link.setAttribute(MARKER, "");
    head.appendChild(link);
  }

  const canonical = document.createElement("link");
  canonical.rel = "canonical";
  canonical.href = `${origin}${withLocale(pathname, locale)}${search}`;
  canonical.setAttribute(MARKER, "");
  head.appendChild(canonical);
}
