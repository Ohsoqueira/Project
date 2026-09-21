"use client";

import { useState, useTransition } from "react";
import { runGenerationAction } from "./actions";

export function RunGenerationButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ generated: number; skipped: number } | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        className="btn-primary"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await runGenerationAction();
            setResult(r);
          })
        }
      >
        {isPending ? "Checking..." : "Generate due work orders now"}
      </button>
      {result ? (
        <span className="text-sm text-slate-500">
          Generated {result.generated}, skipped {result.skipped} (not yet due).
        </span>
      ) : null}
    </div>
  );
}
