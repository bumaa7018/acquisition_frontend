"use client";
import { useSyncExternalStore } from "react";
import { subscribe, getIsBlocking } from "./blocking-loader-state";

export function BlockingLoaderProvider({ children }: { children: React.ReactNode }) {
  const blocking = useSyncExternalStore(
    subscribe,
    getIsBlocking,
    () => false,
  );

  return (
    <>
      {children}
      {blocking && <BlockingOverlay />}
    </>
  );
}

function BlockingOverlay() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
      style={{ pointerEvents: "all" }}
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white dark:bg-[#1e1f27] px-8 py-6 shadow-2xl">
        <svg
          className="h-8 w-8 animate-spin text-[#02c0ce]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
          Уншиж байна...
        </p>
      </div>
    </div>
  );
}
