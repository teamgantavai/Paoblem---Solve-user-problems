'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export default function GSAPModalWrapper({ children, className, style, onClick }: { children: React.ReactNode, className?: string, style?: React.CSSProperties, onClick?: (e: React.MouseEvent) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useGSAP(() => {
    if (containerRef.current) {
      // Backdrop fade-in (assuming this wraps the backdrop too or is inside it)
      gsap.from(containerRef.current, { opacity: 0, duration: 0.2, ease: 'power2.out' });
      
      // Modal scale up
      const modalBox = containerRef.current.querySelector('.modal-box') || containerRef.current.children[0];
      if (modalBox) {
        gsap.fromTo(modalBox, 
          { scale: 0.95, y: 15 }, 
          { scale: 1, y: 0, duration: 0.4, ease: 'power3.out', clearProps: 'transform' }
        );
      }
    }
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className={className} style={style} onClick={onClick}>
      {children}
    </div>
  );
}
