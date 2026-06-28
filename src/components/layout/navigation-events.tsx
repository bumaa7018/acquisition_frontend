"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { notifyNavEnd } from "@/lib/blocking-loader-state";

export function NavigationEvents() {
  const pathname = usePathname();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    notifyNavEnd();
  }, [pathname]);

  return null;
}
