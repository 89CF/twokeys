"use client";

import { useEffect, useState } from "react";

/** True when the page is rendered inside an iframe (e.g. the widget modal). */
export function useEmbedded(): boolean {
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    try {
      setEmbedded(window.self !== window.top);
    } catch {
      setEmbedded(true);
    }
  }, []);
  return embedded;
}
