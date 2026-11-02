import { useEffect, useState } from "react";

/** Same value after `ms` of quiet, so typing doesn't re-render every slide on every keystroke. */
export function useSettled<T>(value: T, ms = 450): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
