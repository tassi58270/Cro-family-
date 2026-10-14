import "server-only";
import { hasDatabase, withSystem } from "@/lib/db";

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** What the email is about, for the log: « login », « suggestion »… */
  topic?: string;
};

/**
 * How emails leave the site:
 *   resend  RESEND_API_KEY is set: real emails (production);
 *   screen  local development or tests with AUTH_DEV_LINKS=on: nothing is
 *           sent, the sign-in link is shown on screen instead;
 *   log     anything else: the email is only written to the server log.
 * « screen » can never be active on Vercel, where the site is reachable by
 * anyone.
 */
export function deliveryMode(): "resend" | "screen" | "log" {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.VERCEL) return "log";
  if (
    process.env.NODE_ENV === "development" ||
    process.env.AUTH_DEV_LINKS === "on"
  ) {
    return "screen";
  }
  return "log";
}

/**
 * Sends an email, or writes it to the log when there is no email service,
 * and keeps a trace of it in private.emails (never readable by the site).
 */
export async function sendEmail(email: Email): Promise<void> {
  let delivery: "sent" | "logged" | "failed" = "logged";
  let error: string | null = null;
  try {
    if (deliveryMode() === "resend") {
      await deliver(email);
      delivery = "sent";
    } else {
      console.info(`[email] to ${email.to}: ${email.subject}\n${email.text}`);
    }
  } catch (cause) {
    delivery = "failed";
    error = String(cause).slice(0, 500);
    throw cause;
  } finally {
    await record(email, delivery, error);
  }
}

async function deliver(email: Email) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Maison de Croÿ <onboarding@resend.dev>",
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Email not sent (${response.status}): ${await response.text()}`,
    );
  }
}

async function record(
  email: Email,
  delivery: "sent" | "logged" | "failed",
  error: string | null,
) {
  if (!hasDatabase()) return;
  try {
    await withSystem((q) =>
      q(
        `insert into private.emails (recipient, subject, body, topic, delivery, error)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          email.to,
          email.subject,
          // Sign-in links are only kept as hashes: never in the log.
          email.text.replace(/jeton=[^\s&]+/g, "jeton=…"),
          email.topic ?? "other",
          delivery,
          error,
        ],
      ),
    );
  } catch (cause) {
    console.error("[email] not recorded", cause);
  }
}

function escape(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * A plain, readable email: a few lines and one link, in the colours of the
 * site. Kept simple so that every mail client shows it well.
 */
export function simpleEmail({
  to,
  subject,
  lines,
  action,
  footer,
  topic,
}: {
  to: string;
  topic?: string;
  subject: string;
  lines: string[];
  action?: { label: string; url: string };
  footer?: string;
}): Email {
  const text = [
    ...lines,
    ...(action ? ["", `${action.label} : ${action.url}`] : []),
    ...(footer ? ["", footer] : []),
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#ffffff;color:#141414;font-family:Georgia,serif">
<div style="max-width:520px;margin:0 auto">
<div style="height:3px;background:#c8102e;width:48px;margin-bottom:5px"></div>
<div style="height:3px;background:#c8102e;width:48px;margin-bottom:5px"></div>
<div style="height:3px;background:#c8102e;width:48px;margin-bottom:28px"></div>
${lines.map((l) => `<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;margin:0 0 16px">${escape(l)}</p>`).join("")}
${action ? `<p style="margin:28px 0"><a href="${escape(action.url)}" style="display:inline-block;background:#c8102e;color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 24px">${escape(action.label)}</a></p>` : ""}
${footer ? `<p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#5f5f5b;margin:32px 0 0">${escape(footer)}</p>` : ""}
</div></body></html>`;

  return { to, subject, text, html, topic };
}
