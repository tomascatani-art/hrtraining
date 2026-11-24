import "server-only";
import { mkdir, appendFile } from "fs/promises";
import path from "path";

// Envío de mails. En producción usa Resend (RESEND_API_KEY + MAIL_FROM).
// Sin configurar, los mails se guardan en ./outbox/mails.log para poder probar sin enviar nada.
export const mailConfigured = () => !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;

export async function sendMail(m: { to: string; subject: string; html: string; text: string }) {
  if (!mailConfigured()) {
    const line = JSON.stringify({ at: new Date().toISOString(), ...m, html: undefined });
    try {
      const dir = path.resolve(process.env.OUTBOX_DIR ?? "./outbox");
      await mkdir(dir, { recursive: true });
      await appendFile(path.join(dir, "mails.log"), line + "\n");
    } catch {
      // En Vercel el disco es de solo lectura: queda en los registros del servidor
      console.log("[mail sin enviar]", line);
    }
    return { sent: false as const };
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
  });
  return { sent: r.ok };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Plantilla simple con la identidad de la app: fondo negro, botón amarillo. */
export function mailLayout(o: { brand: string; title: string; body: string; cta: string; url: string; foot?: string }) {
  const html = `<!doctype html><html><body style="margin:0;background:#050505;font-family:Arial,Helvetica,sans-serif;color:#e5e5e5">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111111;border:1px solid #2e2e2e;border-radius:16px;padding:32px">
<tr><td style="font-size:18px;font-weight:bold;color:#ffffff">${esc(o.brand)}</td></tr>
<tr><td style="height:4px;background:repeating-linear-gradient(-45deg,#ffd60a 0 8px,#050505 8px 16px);border-radius:2px"></td></tr>
<tr><td style="padding-top:24px;font-size:22px;font-weight:bold;color:#ffffff">${esc(o.title)}</td></tr>
<tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#a3a3a3">${esc(o.body)}</td></tr>
<tr><td style="padding-top:24px"><a href="${esc(o.url)}" style="display:inline-block;background:#ffd60a;color:#000000;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:12px">${esc(o.cta)}</a></td></tr>
<tr><td style="padding-top:20px;font-size:12px;color:#737373">${esc(o.foot ?? "Si no esperabas este mail, podés ignorarlo.")}<br>${esc(o.url)}</td></tr>
</table><div style="padding-top:16px;font-size:11px;color:#525252">Con tecnología Hrtraining.co</div></td></tr></table></body></html>`;
  const text = `${o.title}\n\n${o.body}\n\n${o.cta}: ${o.url}\n\n${o.foot ?? "Si no esperabas este mail, podés ignorarlo."}`;
  return { html, text };
}
