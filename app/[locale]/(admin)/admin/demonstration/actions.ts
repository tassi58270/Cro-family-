"use server";

import { getSession, viewerOf } from "@/lib/auth/session";
import { contentChanged } from "@/lib/data/revalidate";
import { withViewer } from "@/lib/db";
import { loadDemo, removeDemo } from "@/lib/demo/load";

export async function loadDemoAction(): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "admin") return;
  await withViewer(viewerOf(session), (q) => loadDemo(q, session.accountId));
  contentChanged();
}

export async function removeDemoAction(): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "admin") return;
  await withViewer(viewerOf(session), (q) => removeDemo(q));
  contentChanged();
}
