import { useEffect, useRef, useState } from 'react';

/**
 * Reveals an element once it nears the viewport, then disconnects.
 * Elements already in view at mount are revealed immediately to avoid a
 * flash-then-fade effect on first paint (e.g. above-the-fold hero content).
 */
export function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLElement | null>(null);
  // Without IntersectionObserver (very old browsers) everything is simply shown.
  const [isVisible, setIsVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const node = ref.current;
    if (!node || isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, isVisible]);

  return { ref, isVisible };
}
