import { createHash, randomBytes } from "node:crypto";

/** A random, unguessable value for a cookie or a link (256 bits). */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this hash is stored, so a leaked database gives no usable token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/** The addresses of ADMIN_EMAILS, which are administrators from their first sign-in. */
export function configuredAdmins(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
}
