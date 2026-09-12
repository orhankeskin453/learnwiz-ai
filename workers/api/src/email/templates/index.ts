import type { Locale } from "@learwizai/types";
import { passwordResetEn, verificationEn, welcomeEn } from "./en";
import type { TemplateContent, TemplateParams } from "./shell";
import { passwordResetTr, verificationTr, welcomeTr } from "./tr";

type TemplateFn = (params: TemplateParams) => TemplateContent;

/** Per-locale template registry — selection is unit-tested (§47.11). */
const REGISTRY: Record<Locale, Record<string, TemplateFn>> = {
  en: { verification: verificationEn, welcome: welcomeEn, password_reset: passwordResetEn },
  tr: { verification: verificationTr, welcome: welcomeTr, password_reset: passwordResetTr },
};

/** Unknown locales fall back to English (§6.1 fallback rule). */
export function renderTemplate(
  templateKey: string,
  locale: Locale,
  params: TemplateParams,
): TemplateContent {
  const templates = REGISTRY[locale] ?? REGISTRY.en;
  const template = templates[templateKey] ?? REGISTRY.en[templateKey];
  if (!template) throw new Error(`Unknown email template: ${templateKey}`);
  return template(params);
}

export type { TemplateContent, TemplateParams } from "./shell";
