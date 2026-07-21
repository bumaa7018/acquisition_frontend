"use client";

// Root layout (src/app/layout.tsx) дотор алдаа гарвал энгийн error.tsx ажиллахгүй —
// Next.js энэ global-error.tsx-г ашиглана. Root layout-г бүхэлд нь орлодог тул
// өөрийн html/body-г заавал агуулна.

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("uncaught root layout error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="mn">
      <body>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Системд алдаа гарлаа</h1>
            <p style={{ marginTop: "0.5rem", color: "#64748b" }}>Хуудсыг дахин ачаална уу.</p>
            <button
              onClick={() => reset()}
              style={{ marginTop: "1.5rem", height: "2.5rem", padding: "0 1.25rem", borderRadius: "0.5rem", background: "#02c0ce", color: "white", fontWeight: 600, border: "none", cursor: "pointer" }}
            >
              Дахин оролдох
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
