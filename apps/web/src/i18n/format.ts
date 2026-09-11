import i18n from "./index";

export function formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", ...options }).format(date);
}

export function formatTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(i18n.language, { timeStyle: "short", ...options }).format(date);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(i18n.language, options).format(value);
}

export function formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit): string {
  return new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" }).format(value, unit);
}
