'use client';

import React, { useState, useEffect, useRef, useCallback, TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex: number;
}

const CLOSE_ANIMATION_MS = 180;
const SWIPE_DISMISS_THRESHOLD = 110;

export default function ImageViewerModal({ isOpen, onClose, images, initialIndex }: ImageViewerModalProps) {
  // Modal stays mounted slightly past isOpen=false so the exit animation can play.
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Swipe-to-dismiss (mobile, only when not zoomed)
  const [swipeY, setSwipeY] = useState(0);
  const swipeStartRef = useRef<{ y: number; x: number } | null>(null);
  const isSwipingRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const triggerElRef = useRef<Element | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ dist: number; scale: number } | null>(null);

  // document.body only exists on the client — wait for mount before portalling
  useEffect(() => {
    setPortalReady(true);
  }, []);

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Animated close: plays fade/zoom-out, then tells the parent to actually close.
  const requestClose = useCallback(() => {
    setIsClosing(true);
  }, []);

  // Mount / reset transient state whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      triggerElRef.current = document.activeElement;
      setIsMounted(true);
      setIsClosing(false);
      setCurrentIndex(initialIndex);
      resetZoom();
      setImgError(false);
      setLoading(true);
      setSwipeY(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialIndex]);

  // Drive the exit animation: when isClosing flips true, wait for the
  // animation to finish, then notify the parent and unmount.
  useEffect(() => {
    if (!isClosing) return;

    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setIsMounted(false);
      onClose();
      if (triggerElRef.current instanceof HTMLElement) {
        triggerElRef.current.focus();
      }
    }, CLOSE_ANIMATION_MS);

    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [isClosing, onClose]);

  // If the parent flips isOpen to false directly (without going through
  // requestClose), still animate out gracefully.
  useEffect(() => {
    if (!isOpen && isMounted && !isClosing) {
      setIsClosing(true);
    }
  }, [isOpen, isMounted, isClosing]);

  // Lock background scroll + freeze the page while mounted
  useEffect(() => {
    if (!isMounted) return;

    const scrollY = window.scrollY;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';

      window.scrollTo(0, scrollY);
    };
  }, [isMounted]);

  // Move focus into the modal on open
  useEffect(() => {
    if (isMounted && !isClosing) {
      closeBtnRef.current?.focus();
    }
  }, [isMounted, isClosing]);

  const handlePrev = useCallback(() => {
    setCurrentIndex(prev => {
      if (prev <= 0) return prev;
      resetZoom();
      setImgError(false);
      setLoading(true);
      return prev - 1;
    });
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => {
      if (prev >= images.length - 1) return prev;
      resetZoom();
      setImgError(false);
      setLoading(true);
      return prev + 1;
    });
  }, [images.length]);

  // Keyboard navigation + ESC to close + focus trap
  useEffect(() => {
    if (!isMounted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'Tab') {
        const root = overlayRef.current;
        if (!root) return;
        const focusable = root.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isMounted, requestClose, handlePrev, handleNext]);

  if (!isMounted || images.length === 0 || !portalReady) return null;

  const currentImage = images[currentIndex];

  const handleZoomIn = () => {
    setScale(prev => Math.min(5, prev + 0.5));
  };

  const handleZoomOut = () => {
    setScale(prev => {
      const next = Math.max(1, prev - 0.5);
      if (next === 1) resetZoom();
      return next;
    });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    setScale(prev => {
      let next = prev;
      if (e.deltaY < 0) {
        next = Math.min(5, prev + zoomFactor);
      } else {
        next = Math.max(1, prev - zoomFactor);
      }
      if (next === 1) resetZoom();
      return next;
    });
  };

  // Drag and pan logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsPanning(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const nextX = e.clientX - dragStart.x;
    const nextY = e.clientY - dragStart.y;
    setPosition({ x: nextX, y: nextY });
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
  };

  // Mobile touch gestures: pinch to zoom, swipe pan, swipe-down to dismiss
  const getTouchDist = (e: TouchEvent) => {
    if (e.touches.length < 2) return 0;
    const x = e.touches[0].clientX - e.touches[1].clientX;
    const y = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(x * x + y * y);
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dist = getTouchDist(e);
      touchStartRef.current = { dist, scale };
    } else if (e.touches.length === 1) {
      if (scale > 1) {
        // Pan start
        setIsPanning(true);
        setDragStart({
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y
        });
      } else {
        // Swipe-to-dismiss start (only meaningful at scale 1)
        swipeStartRef.current = { y: e.touches[0].clientY, x: e.touches[0].clientX };
        isSwipingRef.current = false;
      }
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current) {
      // Pinch zoom
      e.preventDefault();
      const dist = getTouchDist(e);
      if (dist === 0) return;
      const ratio = dist / touchStartRef.current.dist;
      const nextScale = Math.max(1, Math.min(5, touchStartRef.current.scale * ratio));
      setScale(nextScale);
      if (nextScale === 1) resetZoom();
      return;
    }

    if (e.touches.length === 1) {
      if (scale > 1 && isPanning) {
        e.preventDefault();
        const nextX = e.touches[0].clientX - dragStart.x;
        const nextY = e.touches[0].clientY - dragStart.y;
        setPosition({ x: nextX, y: nextY });
        return;
      }

      if (scale === 1 && swipeStartRef.current) {
        const dy = e.touches[0].clientY - swipeStartRef.current.y;
        const dx = e.touches[0].clientX - swipeStartRef.current.x;

        // Only treat as a dismiss-swipe once vertical intent is clear
        if (!isSwipingRef.current && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
          isSwipingRef.current = true;
        }
        if (isSwipingRef.current && dy > 0) {
          e.preventDefault();
          setSwipeY(dy);
        }
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    setIsPanning(false);

    if (isSwipingRef.current) {
      if (swipeY > SWIPE_DISMISS_THRESHOLD) {
        requestClose();
      } else {
        setSwipeY(0);
      }
    }
    swipeStartRef.current = null;
    isSwipingRef.current = false;
  };

  // Clicking the backdrop (not the image, not a control) closes the modal.
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      requestClose();
    }
  };

  const swipeProgress = Math.min(1, swipeY / (SWIPE_DISMISS_THRESHOLD * 2.2));
  const swipeOpacity = 1 - swipeProgress * 0.6;
  const swipeScale = 1 - swipeProgress * 0.08;

  return createPortal(
    <div
      ref={overlayRef}
      className={`viewer-overlay ${isClosing ? 'is-closing' : 'is-open'}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Image ${currentIndex + 1} of ${images.length}`}
      onClick={handleBackdropClick}
      onWheel={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={swipeY > 0 ? { backgroundColor: `rgba(0, 0, 0, ${swipeOpacity})` } : undefined}
    >
      {/* Top Header: just the counter and the close button, nothing else */}
      <div className="viewer-header">
        <div className="viewer-counter" aria-hidden="true">
          {currentIndex + 1} / {images.length}
        </div>
        <button
          ref={closeBtnRef}
          className="viewer-btn viewer-btn-close"
          onClick={requestClose}
          aria-label="Close image viewer"
          title="Close"
        >
          <X size={22} />
        </button>
      </div>

      {/* Main Display Stage */}
      <div className="viewer-main" onWheel={handleWheel} onClick={handleBackdropClick}>
        {/* Navigation Arrows */}
        {currentIndex > 0 && (
          <button
            className="viewer-nav-btn prev"
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            aria-label="Previous image"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        <div
          className="viewer-stage"
          onClick={handleBackdropClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {loading && !imgError && (
            <div className="viewer-spinner-wrap" aria-hidden="true">
              <div className="spin viewer-spinner" />
            </div>
          )}

          {imgError ? (
            <div className="viewer-error" role="alert">
              <ImageIcon size={48} style={{ marginBottom: '1rem', color: '#ef4444' }} />
              <p style={{ fontSize: '0.88rem' }}>Failed to load image.</p>
              <p style={{ fontSize: '0.72rem', marginTop: '4px', maxWidth: '300px', opacity: 0.8 }}>The URL might be broken, expired, or access is restricted.</p>
            </div>
          ) : (
            <div
              ref={containerRef}
              className={`viewer-image-container ${isPanning ? 'panning' : ''}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              style={{
                transform: `translate(${position.x}px, ${position.y + swipeY}px) scale(${scale * swipeScale})`,
                transition: isPanning || swipeY > 0 ? 'none' : 'transform 0.15s ease-out'
              }}
            >
              <img
                src={currentImage}
                alt={`Viewer item ${currentIndex + 1}`}
                className="viewer-img"
                draggable={false}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setImgError(true);
                  setLoading(false);
                }}
              />
            </div>
          )}

          {/* Corner zoom toolbar — sits on the image itself, bottom-right */}
          {!imgError && (
            <div className="viewer-zoom-toolbar" onClick={(e) => e.stopPropagation()}>
              <button
                className="viewer-zoom-btn"
                onClick={handleZoomIn}
                aria-label="Zoom in"
                title="Zoom in"
              >
                <ZoomIn size={16} />
              </button>
              <button
                className="viewer-zoom-btn"
                onClick={handleZoomOut}
                aria-label="Zoom out"
                title="Zoom out"
                disabled={scale === 1}
              >
                <ZoomOut size={16} />
              </button>
              <button
                className="viewer-zoom-btn"
                onClick={resetZoom}
                aria-label="Reset zoom"
                title="Reset zoom"
                disabled={scale === 1 && position.x === 0 && position.y === 0}
              >
                <RotateCcw size={14} />
              </button>
            </div>
          )}
        </div>

        {currentIndex < images.length - 1 && (
          <button
            className="viewer-nav-btn next"
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            aria-label="Next image"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}