"use client";

import { useSyncExternalStore } from "react";
import { newerVersion, styleVersionSnapshot, subscribeStyleVersion } from "./styleVersion";

/** The slide style version to put in preview addresses: the server's, unless Settings changed the style since this page was rendered. */
export function useStyleVersion(fromServer: string | undefined): string | undefined {
  const fromBrowser = useSyncExternalStore(subscribeStyleVersion, styleVersionSnapshot, () => null);
  return newerVersion(fromServer, fromBrowser);
}
