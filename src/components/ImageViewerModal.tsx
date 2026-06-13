'use client';

import React, { useState, useEffect, useRef, TouchEvent } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex: number;
}

export default function ImageViewerModal({ isOpen, onClose, images, initialIndex }: ImageViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ dist: number; scale: number } | null>(null);

  // Sync index when initialIndex changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      resetZoom();
      setImgError(false);
      setLoading(true);
    }
  }, [isOpen, initialIndex]);

  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, currentIndex, images]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetZoom();
      setImgError(false);
      setLoading(true);
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetZoom();
      setImgError(false);
      setLoading(true);
    }
  };

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

  // Mobile touch gestures: pinch to zoom & swipe pan
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
    } else if (e.touches.length === 1 && scale > 1) {
      // Pan start
      setIsPanning(true);
      setDragStart({ 
        x: e.touches[0].clientX - position.x, 
        y: e.touches[0].clientY - position.y 
      });
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
    } else if (e.touches.length === 1 && isPanning) {
      // Pan move
      const nextX = e.touches[0].clientX - dragStart.x;
      const nextY = e.touches[0].clientY - dragStart.y;
      setPosition({ x: nextX, y: nextY });
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    setIsPanning(false);
  };

  return (
    <div 
      className="viewer-overlay" 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Header Controls */}
      <div className="viewer-header">
        <div className="viewer-counter">
          {currentIndex + 1} / {images.length}
        </div>
        <div className="viewer-actions">
          <button className="viewer-btn" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn size={20} />
          </button>
          <button className="viewer-btn" onClick={handleZoomOut} title="Zoom Out" disabled={scale === 1}>
            <ZoomOut size={20} />
          </button>
          <button className="viewer-btn" onClick={resetZoom} title="Reset Scale" disabled={scale === 1 && position.x === 0 && position.y === 0}>
            <RotateCcw size={18} />
          </button>
          <button className="viewer-btn" onClick={onClose} style={{ marginLeft: '10px' }} title="Close Lightbox">
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Main Display Stage */}
      <div className="viewer-main" onWheel={handleWheel}>
        {/* Navigation Arrows */}
        {currentIndex > 0 && (
          <button className="viewer-nav-btn prev" onClick={handlePrev} aria-label="Previous image">
            <ChevronLeft size={24} />
          </button>
        )}
        
        <div className="viewer-stage">
          {loading && !imgError && (
            <div style={{ position: 'absolute', color: 'white' }}>
              <div className="spin" style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%' }} />
            </div>
          )}

          {imgError ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
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
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transition: isPanning ? 'none' : 'transform 0.15s ease-out'
              }}
            >
              <img 
                src={currentImage} 
                alt={`Viewer item ${currentIndex + 1}`} 
                className="viewer-img"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setImgError(true);
                  setLoading(false);
                }}
              />
            </div>
          )}
        </div>

        {currentIndex < images.length - 1 && (
          <button className="viewer-nav-btn next" onClick={handleNext} aria-label="Next image">
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Footer Hint */}
      <div className="viewer-footer">
        Use Mouse Wheel or Pinch to Zoom. Drag to Pan. Use Arrow Keys to navigate.
      </div>
    </div>
  );
}
