"use client";

import { Button } from "@/components/ui/button";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button
      variant="secondary"
      className="print:hidden"
      onClick={() => window.print()}
    >
      {label}
    </Button>
  );
}
