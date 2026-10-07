import { useEffect, useRef, useState } from "react";

/**
 * Tracks an element's rendered width in CSS pixels.
 *
 * Needed for SVG paths that must not be scaled non-uniformly: a wavy line has to
 * be generated at its real pixel width, because stretching a sine wave with
 * `preserveAspectRatio="none"` distorts the wave itself.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    setWidth(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
