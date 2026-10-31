"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** Delay in ms, for light staggering between siblings. */
  delay?: number;
  className?: string;
  /**
   * For content that is already on screen when the page opens. It is shown from the first paint instead of waiting
   * for JavaScript to load and run, which on a slow connection would leave an empty gap at the top of the page.
   */
  immediate?: boolean;
}

/** Fades content in once when it enters the viewport. Content is visible without JS. */
export function Reveal({ children, delay = 0, className, immediate = false }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(immediate);

  useEffect(() => {
    if (immediate) return;
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      // Very old browsers: show the content instead of leaving it hidden.
      queueMicrotask(() => setVisible(true));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [immediate]);

  return (
    <div
      ref={ref}
      data-reveal={visible ? "visible" : "pending"}
      className={className}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
