import "server-only";
import type { Query } from "@/lib/db";
import { configuredAdmins } from "./tokens";

/**
 * Who may receive a sign-in link: an administrator listed in ADMIN_EMAILS,
 * an existing active member, someone invited, or someone whose access
 * request was approved (cahier des charges, section 4).
 */
export async function mayAccess(q: Query, email: string): Promise<boolean> {
  if (configuredAdmins().includes(email)) return true;
  const rows = await q<{ allowed: boolean }>(
    `select
       exists (
         select 1 from private.accounts a join public.profiles p on p.id = a.id
         where a.email = $1 and p.disabled_at is null
       )
       or exists (
         select 1 from public.invitations where email = $1 and accepted_at is null
       )
       or exists (
         select 1 from public.access_requests where email = $1 and state = 'approved'
       ) as allowed`,
    [email],
  );
  return rows[0]?.allowed ?? false;
}

/** The role an account gets, or keeps, when it signs in. */
export async function roleFor(
  q: Query,
  email: string,
): Promise<"admin" | "member"> {
  if (configuredAdmins().includes(email)) return "admin";
  const rows = await q<{ role: "admin" | "member" }>(
    `select role from public.invitations
     where email = $1 and accepted_at is null
     order by created_at desc limit 1`,
    [email],
  );
  return rows[0]?.role ?? "member";
}
