/** Content pieces every auth email must provide (§40.14). */
export interface TemplateContent {
  subject: string;
  html: string;
  text: string;
}

export interface TemplateParams {
  url: string;
  /** Verification pages can show the address the link was sent to. */
  email?: string;
}

/** Minimal shared HTML shell — text/plain always provided alongside (§40.14). */
export function htmlShell(
  title: string,
  paragraphs: string[],
  ctaLabel: string,
  url: string,
  footer: string,
): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px">${escapeHtml(p)}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px">${escapeHtml(title)}</h1>
  ${body}
  <a href="${escapeHtml(url)}" style="display:inline-block;background:#6366f1;color:#ffffff;padding:10px 18px;border-radius:10px;text-decoration:none;font-size:14px">${escapeHtml(ctaLabel)}</a>
  <p style="font-size:12px;color:#94a3b8;margin-top:20px">${escapeHtml(footer)}</p>
</div>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
