'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export function ScrollReveal({ children }: { children: ReactNode }) {
  const scopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    const targets = scope.querySelectorAll<HTMLElement>('[data-scroll-reveal]');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('scroll-reveal-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('scroll-reveal-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    targets.forEach((target) => {
      target.classList.add('scroll-reveal-target');
      observer.observe(target);
    });

    return () => observer.disconnect();
  }, []);

  return <div ref={scopeRef} className="scroll-reveal-scope">{children}</div>;
}
