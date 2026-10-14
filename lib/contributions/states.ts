import type { ContentStatus } from "@/components/ui/chip";

/** How a proposal's state is shown, with the content status chips. */
export const PROPOSAL_CHIP: Record<
  "sent" | "reviewing" | "accepted" | "rejected",
  ContentStatus
> = {
  sent: "pending",
  reviewing: "pending",
  accepted: "published",
  rejected: "rejected",
};
