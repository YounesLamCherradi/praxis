import { useEffect, useRef, useState } from "react";

/**
 * Replaces the old vanilla-JS IntersectionObserver in landing.html's
 * setupScrollReveal(). Attach the returned ref to any section, then
 * spread the className to get the "reveal-3d" -> "revealed-active" transition.
 *
 * Usage:
 *   const { ref, revealed } = useScrollReveal();
 *   <section ref={ref} className={`reveal-3d ${revealed ? "revealed-active" : ""}`}>
 */
export default function useScrollReveal() {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, revealed };
}