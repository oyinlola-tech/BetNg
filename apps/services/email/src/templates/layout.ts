/** Escapes for an HTML text node or a quoted attribute. Every variable reaches the page through this. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface LayoutOptions {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  /** Rendered as a large monospace block: a verification code or a temporary password. */
  readonly code?: string | undefined;
  readonly footer?: string | undefined;
}

const SIGN_OFF = "BetNG will never ask you for a code or a password by email, phone or chat.";

/**
 * One inline-styled table layout for every message. Email clients strip <style> blocks and have no
 * support for custom properties, so the colours are literals here and nowhere else in the service.
 */
export function layout(options: LayoutOptions): { html: string; text: string } {
  const paragraphs = options.paragraphs
    .map((line) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2430;">${escapeHtml(line)}</p>`)
    .join("");

  const code =
    options.code === undefined
      ? ""
      : `<p style="margin:0 0 24px;padding:16px 20px;background:#f4f6fa;border-radius:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:26px;letter-spacing:4px;color:#0b1220;text-align:center;">${escapeHtml(options.code)}</p>`;

  const footer = options.footer === undefined ? SIGN_OFF : `${options.footer} ${SIGN_OFF}`;

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(options.heading)}</title></head>
<body style="margin:0;padding:24px 12px;background:#eef1f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-collapse:collapse;background:#ffffff;border-radius:14px;">
<tr><td style="padding:28px 28px 8px;">
<p style="margin:0 0 20px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#6b7280;">BetNG</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0b1220;font-weight:600;">${escapeHtml(options.heading)}</h1>
${paragraphs}${code}
</td></tr>
<tr><td style="padding:0 28px 28px;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">${escapeHtml(footer)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    options.heading,
    "",
    ...options.paragraphs,
    ...(options.code === undefined ? [] : ["", options.code]),
    "",
    footer,
    "",
  ].join("\n");

  return { html, text };
}
