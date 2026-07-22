'use client';

import { useEffect, useRef, useState } from 'react';

/** Fades/slides content in the first time it scrolls into view — used to keep the page feeling alive past the hero. */
export function Reveal({
  children,
  delay = 0,
  className = '',
  from = 'bottom',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  from?: 'bottom' | 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hiddenTransform = from === 'left' ? '-translate-x-8' : from === 'right' ? 'translate-x-8' : 'translate-y-8';

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-x-0 translate-y-0' : `opacity-0 ${hiddenTransform}`} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
