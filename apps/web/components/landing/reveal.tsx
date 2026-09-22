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
      { threshold: 0.05, rootMargin: '60px 0px -20px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hiddenTransform = from === 'left' ? '-translate-x-4' : from === 'right' ? 'translate-x-4' : 'translate-y-4';

  return (
    <div
      ref={ref}
      className={`transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${visible ? 'opacity-100 translate-x-0 translate-y-0' : `opacity-0 ${hiddenTransform}`} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
