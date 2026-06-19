'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

gsap.registerPlugin(useGSAP);

export function useMicroAnimations() {
  const { contextSafe } = useGSAP();

  // 1. Button spring effect (on hover / press)
  const animateButtonPress = contextSafe((e: React.MouseEvent<HTMLElement>) => {
    gsap.to(e.currentTarget, { scale: 0.95, duration: 0.1, ease: 'power2.out' });
  });

  const animateButtonRelease = contextSafe((e: React.MouseEvent<HTMLElement>) => {
    gsap.to(e.currentTarget, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
  });
  
  const animateButtonHover = contextSafe((e: React.MouseEvent<HTMLElement>) => {
    gsap.to(e.currentTarget, { scale: 1.02, duration: 0.2, ease: 'power2.out' });
  });

  const animateButtonHoverOut = contextSafe((e: React.MouseEvent<HTMLElement>) => {
    gsap.to(e.currentTarget, { scale: 1, duration: 0.2, ease: 'power2.out' });
  });

  // 2. Card hover lift
  const animateCardHover = contextSafe((e: React.MouseEvent<HTMLElement>) => {
    gsap.to(e.currentTarget, { 
      y: -4, 
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
      duration: 0.3, 
      ease: 'power2.out' 
    });
  });

  const animateCardHoverOut = contextSafe((e: React.MouseEvent<HTMLElement>) => {
    gsap.to(e.currentTarget, { 
      y: 0, 
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
      duration: 0.3, 
      ease: 'power2.out' 
    });
  });

  // 3. Staggered list entrance
  const animateListEntrance = contextSafe((containerRef: React.RefObject<HTMLElement | null>, itemSelector: string) => {
    if (!containerRef.current) return;
    
    // Set initial state
    gsap.set(gsap.utils.toArray(containerRef.current.querySelectorAll(itemSelector)), { 
      opacity: 0, 
      y: 20 
    });

    // Animate
    gsap.to(gsap.utils.toArray(containerRef.current.querySelectorAll(itemSelector)), {
      opacity: 1,
      y: 0,
      duration: 0.5,
      stagger: 0.05,
      ease: 'back.out(1.2)',
      clearProps: 'opacity,transform' // Only clean up animated properties to preserve inline styles
    });
  });

  // 4. Modal pop entrance
  const animateModalEntrance = contextSafe((modalRef: React.RefObject<HTMLElement | null>, backdropRef?: React.RefObject<HTMLElement | null>) => {
    if (backdropRef?.current) {
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' });
    }
    
    if (modalRef.current) {
      gsap.fromTo(modalRef.current, 
        { opacity: 0, scale: 0.95, y: 10 }, 
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.2)' }
      );
    }
  });

  // 5. Message pop-in
  const animateMessageEntrance = contextSafe((messageRef: React.RefObject<HTMLElement | null>, isSelf: boolean) => {
    if (!messageRef.current) return;
    
    gsap.fromTo(messageRef.current,
      { opacity: 0, scale: 0.9, x: isSelf ? 20 : -20, transformOrigin: isSelf ? 'right bottom' : 'left bottom' },
      { opacity: 1, scale: 1, x: 0, duration: 0.35, ease: 'back.out(1.5)', clearProps: 'opacity,transform' }
    );
  });

  // 6. Upvote jump animation
  const animateUpvote = contextSafe((target: HTMLElement) => {
    const icon = target.querySelector('svg') || target;
    gsap.set(icon, { transformOrigin: 'center center' });
    gsap.timeline()
      .to(icon, { y: -6, scale: 1.3, duration: 0.12, ease: 'power2.out' })
      .to(icon, { y: 0, scale: 1, duration: 0.2, ease: 'back.out(2)' });
  });

  return {
    animateUpvote,
    animateButtonPress,
    animateButtonRelease,
    animateButtonHover,
    animateButtonHoverOut,
    animateCardHover,
    animateCardHoverOut,
    animateListEntrance,
    animateModalEntrance,
    animateMessageEntrance,
    contextSafe
  };
}
