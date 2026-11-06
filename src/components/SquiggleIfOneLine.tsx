"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { StepWord } from "./StepWord";

/** The name with the coral squiggle, unless it runs onto a second line: the line is drawn for one line of text and would cut through the next. */
export function SquiggleIfOneLine({ text }: { text: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const [wrapped, setWrapped] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWrapped(el.getBoundingClientRect().height > parseFloat(getComputedStyle(el).lineHeight) * 1.5);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);
  return (
    <span ref={box} className="inline-block max-w-full">
      {wrapped ? text : <StepWord>{text}</StepWord>}
    </span>
  );
}
