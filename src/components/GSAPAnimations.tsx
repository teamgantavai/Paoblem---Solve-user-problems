'use client';

import { useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

gsap.registerPlugin(useGSAP);

export default function GSAPAnimations() {
  const { contextSafe } = useGSAP();

  const handleMousedown = contextSafe((e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('button, a, .composer-action-btn, .action-btn');
    if (target) {
      gsap.to(target, { scale: 0.95, duration: 0.1, ease: 'power2.out', overwrite: 'auto' });
    }
  });

  const handleMouseup = contextSafe((e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('button, a, .composer-action-btn, .action-btn');
    if (target) {
      gsap.to(target, { scale: 1, duration: 0.35, ease: 'power3.out', overwrite: 'auto' });
    }
  });

  useEffect(() => {
    document.addEventListener('mousedown', handleMousedown);
    document.addEventListener('mouseup', handleMouseup);
    document.addEventListener('mouseout', handleMouseup); // catch leaving element while pressed
    
    return () => {
      document.removeEventListener('mousedown', handleMousedown);
      document.removeEventListener('mouseup', handleMouseup);
      document.removeEventListener('mouseout', handleMouseup);
    };
  }, [handleMousedown, handleMouseup]);

  return null;
}
