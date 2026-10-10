"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/button";
import { FilterChip, PersonChip } from "@/components/ui/chip";
import { PLAY_TRANSITION_EVENT } from "@/components/ui/page-transition";
import { SidePanel } from "@/components/ui/side-panel";

/** Interactive pieces of the /style page. */

export function BusyButtonDemo() {
  const t = useTranslations("style");
  const [busy, setBusy] = useState(false);
  return (
    <Button
      busy={busy}
      onClick={() => {
        setBusy(true);
        setTimeout(() => setBusy(false), 1600);
      }}
    >
      {t("buttonBusy")}
    </Button>
  );
}

export function FilterDemo({ labels }: { labels: string[] }) {
  const [active, setActive] = useState<string[]>([labels[0]]);
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <FilterChip
          key={label}
          pressed={active.includes(label)}
          onClick={() =>
            setActive((current) =>
              current.includes(label)
                ? current.filter((l) => l !== label)
                : [...current, label],
            )
          }
        >
          {label}
        </FilterChip>
      ))}
    </div>
  );
}

export function PanelDemo() {
  const t = useTranslations("style");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t("panelOpen")}
      </Button>
      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={t("panelEyebrow")}
        title={t("panelTitle")}
        footer={
          <ButtonLink href="/arbre" size="sm">
            {t("panelAction")}
          </ButtonLink>
        }
      >
        <div className="grid gap-6">
          <p className="text-ink-muted">{t("panelBody")}</p>
          <div className="flex flex-wrap gap-2">
            <PersonChip name={t("chipPerson2")} href="/arbre" />
          </div>
          {/* Long content shows that the panel scrolls on its own. */}
          <div className="grid gap-3" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-16 bg-paper-2" />
            ))}
          </div>
        </div>
      </SidePanel>
    </>
  );
}

export function ReplayTransition() {
  const t = useTranslations("style");
  return (
    <Button
      variant="ghost"
      onClick={() => window.dispatchEvent(new Event(PLAY_TRANSITION_EVENT))}
    >
      {t("replayTransition")}
    </Button>
  );
}
