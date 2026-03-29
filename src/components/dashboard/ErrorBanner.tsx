"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/dashboard/primitives";

export function ErrorBanner({
  message,
  tone = "error",
}: {
  message: string;
  tone?: "error" | "success";
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "rounded-2xl px-5 py-4 text-sm",
        tone === "success"
          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "border border-red-500/30 bg-red-500/10 text-red-300",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p>{message}</p>
        <button
          onClick={() => setVisible(false)}
          className={cn(
            "flex-shrink-0",
            tone === "success" ? "text-emerald-300 hover:text-emerald-100" : "text-red-400 hover:text-red-200",
          )}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
