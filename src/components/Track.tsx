"use client";

import { useEffect } from "react";
import { track, type DemoEvent, type DemoEventSource } from "@/lib/events";

/** Renders nothing; records that the visitor reached this step of the demo (once per tab session). */
export function Track({ event, source = "sample" }: { event: DemoEvent; source?: DemoEventSource }) {
  useEffect(() => {
    track(event, source);
  }, [event, source]);
  return null;
}
