"use client";

import { useTranslations } from "next-intl";
import {
  deleteStory,
  reviewStory,
} from "@/app/[locale]/(membre)/compte/histoires/actions";
import { StatusChip } from "@/components/ui/chip";
import type { StoryListItem } from "@/lib/data/story-editor";
import { Link, useRouter } from "@/lib/i18n/navigation";

/** Stories with their state: one's own in the member area, all in the dashboard. */
export function StoryList({
  stories,
  mode,
}: {
  stories: StoryListItem[];
  mode: "member" | "admin";
}) {
  const t = useTranslations("storyEditor");
  const router = useRouter();
  const act =
    (action: (form: FormData) => Promise<void>, confirm?: string) =>
    async (form: FormData) => {
      if (confirm && !window.confirm(confirm)) return;
      await action(form);
      router.refresh();
    };
  if (!stories.length) return <p className="text-ink-muted">{t("none")}</p>;
  return (
    <ul className="grid border-t border-hairline">
      {stories.map((s) => (
        <li
          key={s.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline py-3 max-sm:[&>*:first-child]:basis-full"
        >
          <span className="grid min-w-0 flex-1">
            <span className="font-medium">{s.title}</span>
            {mode === "admin" && s.authorName && (
              <span className="text-caption text-ink-muted">
                {t("byline", { name: s.authorName })}
              </span>
            )}
          </span>
          <StatusChip status={s.status}>{t(`status.${s.status}`)}</StatusChip>
          {s.featured && (
            <StatusChip status="published">{t("featuredChip")}</StatusChip>
          )}
          {s.status === "published" && (
            <Link
              href={{
                pathname: "/histoires/[histoire]",
                params: { histoire: s.slug },
              }}
              className="link min-h-11 content-center text-caption"
            >
              {t("read")}
            </Link>
          )}
          {(mode === "admin" || s.status !== "published") && (
            <Link
              href={
                mode === "admin"
                  ? {
                      pathname: "/admin/histoires/[histoire]",
                      params: { histoire: s.id },
                    }
                  : {
                      pathname: "/compte/histoires/[histoire]",
                      params: { histoire: s.id },
                    }
              }
              className="link min-h-11 content-center text-caption font-medium"
            >
              {t("edit")}
            </Link>
          )}
          {mode === "admin" && s.status === "pending" && (
            <>
              <form action={act(reviewStory)}>
                <input type="hidden" name="id" value={s.id} />
                <button
                  name="decision"
                  value="publish"
                  className="link min-h-11 text-caption font-medium"
                >
                  {t("publish")}
                </button>
              </form>
              <form action={act(reviewStory)}>
                <input type="hidden" name="id" value={s.id} />
                <button
                  name="decision"
                  value="reject"
                  className="link min-h-11 text-caption"
                >
                  {t("reject")}
                </button>
              </form>
            </>
          )}
          {mode === "admin" && s.status === "published" && (
            <form action={act(reviewStory)}>
              <input type="hidden" name="id" value={s.id} />
              <button
                name="decision"
                value={s.featured ? "unfeature" : "feature"}
                className="link min-h-11 text-caption"
              >
                {s.featured ? t("unfeature") : t("feature")}
              </button>
            </form>
          )}
          {(mode === "admin" || s.status !== "published") && (
            <form action={act(deleteStory, t("confirmDelete"))}>
              <input type="hidden" name="id" value={s.id} />
              <button className="link min-h-11 text-caption text-ink-muted">
                {t("delete")}
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
