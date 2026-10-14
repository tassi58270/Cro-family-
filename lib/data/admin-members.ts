import "server-only";
import type { Query } from "@/lib/db";
import { personName } from "@/lib/genealogie/names";

/** The Members screen (section 7): requests, invitations, accounts. */

export type AccessRequest = {
  id: string;
  name: string;
  email: string;
  relation: string;
  message: string | null;
  createdAt: string;
};

export type Invitation = {
  id: string;
  email: string;
  name: string | null;
  role: "member" | "admin";
  createdAt: string;
};

export type Member = {
  id: string;
  email: string;
  name: string | null;
  role: "member" | "admin";
  person: string | null;
  disabled: boolean;
  lastLogin: string | null;
};

export async function loadMembers(q: Query) {
  const requests = await q<AccessRequest>(
    `select id, full_name as name, email::text as email, relation, message, created_at::text as "createdAt"
     from public.access_requests where state = 'pending' order by created_at`,
  );
  const invitations = await q<Invitation>(
    `select id, email::text as email, full_name as name, role, created_at::text as "createdAt"
     from public.invitations where accepted_at is null order by created_at desc`,
  );
  const rows = await q<{
    id: string;
    email: string;
    display_name: string | null;
    role: Member["role"];
    person_id: string | null;
    disabled_at: string | null;
    last_login_at: string | null;
  }>("select * from public.admin_members()");
  const people = await q<{
    id: string;
    given_names: string | null;
    surname: string | null;
    epithet: string | null;
  }>(
    "select id, given_names, surname, epithet from public.people where id = any($1)",
    [rows.map((r) => r.person_id).filter(Boolean)],
  );
  const members: Member[] = rows.map((r) => {
    const person = people.find((p) => p.id === r.person_id);
    return {
      id: r.id,
      email: r.email,
      name: r.display_name,
      role: r.role,
      person: person ? personName(person) : null,
      disabled: r.disabled_at !== null,
      lastLogin: r.last_login_at,
    };
  });
  return { requests, invitations, members };
}
