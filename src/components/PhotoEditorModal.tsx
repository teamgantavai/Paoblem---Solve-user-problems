'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RotateCw, Check, X, Sliders, Crop, Move } from 'lucide-react';

interface PhotoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onSave: (editedBlob: Blob, editedDataUrl: string) => void;
}

type PhotoFilter = 'none' | 'grayscale' | 'sepia' | 'brightness' | 'blur';
type AspectRatio = 'free' | '1:1' | '4:3' | '16:9';
type DragAction = 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w' | null;

interface CropRect {
  x: number; // percentage 0-100 relative to image
  y: number;
  w: number;
  h: number;
}

export default function PhotoEditorModal({ isOpen, onClose, imageUrl, onSave }: PhotoEditorModalProps) {
  const [rotation, setRotation] = useState(0);
  const [filter, setFilter] = useState<PhotoFilter>('none');
  const [processing, setProcessing] = useState(false);

  // Crop state
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('free');
  
  // Dragging state
  const [dragAction, setDragAction] = useState<DragAction>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; rect: CropRect } | null>(null);

  // Rendered image position inside container
  const [imgPos, setImgPos] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Update bounds of rendered image relative to the black container
  const updateImageBounds = useCallback(() => {
    const img = imageRef.current;
    const container = imageContainerRef.current;
    if (!img || !container) return;
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setImgPos({
      left: imgRect.left - containerRect.left,
      top: imgRect.top - containerRect.top,
      width: imgRect.width,
      height: imgRect.height,
    });
  }, []);

  // Listen to window resize to update crop overlay position
  useEffect(() => {
    if (isOpen && cropMode) {
      window.addEventListener('resize', updateImageBounds);
      // Small timeout to allow render layout to complete
      const timer = setTimeout(updateImageBounds, 100);
      return () => {
        window.removeEventListener('resize', updateImageBounds);
        clearTimeout(timer);
      };
    }
  }, [isOpen, cropMode, rotation, updateImageBounds]);

  useEffect(() => {
    if (isOpen) {
      setRotation(0);
      setFilter('none');
      
      // Auto-detect recommended aspect ratios based on edit target type
      // Check if image target is a banner/cover or profile photo
      const isBanner = imageUrl.includes('cover') || (typeof window !== 'undefined' && window.location.hash === '#cover');
      
      // Set aspect ratio and enable crop mode instantly
      setCropMode(true);
      if (isBanner) {
        setAspectRatio('16:9');
        setTimeout(() => initDefaultCrop('16:9'), 50);
      } else {
        setAspectRatio('1:1');
        setTimeout(() => initDefaultCrop('1:1'), 50);
      }
      
      setDragAction(null);
      setDragStart(null);
      setImgPos(null);
    }
  }, [isOpen, imageUrl]);

  if (!isOpen) return null;

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    // Clearing crop if rotation happens, since coordinates change
    setCropRect(null);
  };

  const getRelativePosToImage = (clientX: number, clientY: number) => {
    const img = imageRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const initDefaultCrop = (ratio: AspectRatio) => {
    updateImageBounds();
    const img = imageRef.current;
    if (!img) return;

    let w = 80;
    let h = 80;

    if (ratio !== 'free') {
      const imgWidth = img.clientWidth;
      const imgHeight = img.clientHeight;
      const imgRatio = imgWidth / imgHeight;

      let targetRatio = 1;
      if (ratio === '4:3') targetRatio = 4 / 3;
      else if (ratio === '16:9') targetRatio = 16 / 9;

      // Fit target ratio inside the 80% maximum boundary
      if (imgRatio > targetRatio) {
        // Image is wider than crop aspect ratio
        h = 80;
        w = 80 * (targetRatio / imgRatio);
      } else {
        // Image is taller than crop aspect ratio
        w = 80;
        h = 80 * (imgRatio / targetRatio);
      }
    }

    const x = (100 - w) / 2;
    const y = (100 - h) / 2;
    setCropRect({ x, y, w, h });
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent, action: DragAction) => {
    if (!cropMode || !cropRect) return;
    e.stopPropagation();
    e.preventDefault();

    const point = 'touches' in e ? e.touches[0] : e;
    const pos = getRelativePosToImage(point.clientX, point.clientY);

    setDragAction(action);
    setDragStart({ x: pos.x, y: pos.y, rect: { ...cropRect } });
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!cropMode || !dragAction || !dragStart || !cropRect) return;
    e.preventDefault();

    const point = 'touches' in e ? e.touches[0] : e;
    const pos = getRelativePosToImage(point.clientX, point.clientY);

    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;

    let { x, y, w, h } = dragStart.rect;

    // Fixed aspect ratio multiplier helper
    const getTargetRatioMultiplier = () => {
      if (aspectRatio === '1:1') return 1;
      if (aspectRatio === '4:3') return 4 / 3;
      if (aspectRatio === '16:9') return 16 / 9;
      return null;
    };

    const targetRatio = getTargetRatioMultiplier();
    const img = imageRef.current;
    const imgRatio = img ? img.clientWidth / img.clientHeight : 1;

    if (dragAction === 'move') {
      // Reposition crop box
      x = Math.max(0, Math.min(100 - w, x + dx));
      y = Math.max(0, Math.min(100 - h, y + dy));
    } else {
      // Handle resizing based on handle selected
      let newX = x;
      let newY = y;
      let newW = w;
      let newH = h;

      if (dragAction.includes('w')) {
        const maxX = x + w - 5;
        newX = Math.max(0, Math.min(maxX, x + dx));
        newW = w - (newX - x);
      } else if (dragAction.includes('e')) {
        newW = Math.max(5, Math.min(100 - x, w + dx));
      }

      if (dragAction.includes('n')) {
        const maxY = y + h - 5;
        newY = Math.max(0, Math.min(maxY, y + dy));
        newH = h - (newY - y);
      } else if (dragAction.includes('s')) {
        newH = Math.max(5, Math.min(100 - y, h + dy));
      }

      // Apply aspect ratio constraints if active
      if (targetRatio && img) {
        // Ratio of crop in percentage is: (newW / newH) * imgRatio = targetRatio
        // Hence, newW = (targetRatio / imgRatio) * newH
        const scalingFactor = targetRatio / imgRatio;

        if (dragAction === 'e' || dragAction === 'w' || dragAction === 'n' || dragAction === 's') {
          // Single edge dragging with aspect ratio
          if (dragAction === 'e' || dragAction === 'w') {
            newH = newW / scalingFactor;
            if (newH + newY > 100) {
              newH = 100 - newY;
              newW = newH * scalingFactor;
            }
          } else {
            newW = newH * scalingFactor;
            if (newW + newX > 100) {
              newW = 100 - newX;
              newH = newW / scalingFactor;
            }
          }
        } else {
          // Corner dragging: match the dimension that changed most or default to width-based
          newH = newW / scalingFactor;
          if (newH + newY > 100 || newY < 0) {
            // Adjust to fit screen boundaries
            if (dragAction.includes('n')) {
              newY = Math.max(0, newY);
              newH = y + h - newY;
              newW = newH * scalingFactor;
            } else {
              newH = 100 - newY;
              newW = newH * scalingFactor;
            }
          }
        }
      }

      x = newX;
      y = newY;
      w = newW;
      h = newH;
    }

    setCropRect({ x, y, w, h });
  };

  const handlePointerUp = () => {
    setDragAction(null);
    setDragStart(null);
  };

  const handleClearCrop = () => {
    setCropRect(null);
    setCropMode(false);
  };

  const handleApply = () => {
    setProcessing(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) { setProcessing(false); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { setProcessing(false); return; }

      // Calculate crop region on the original image dimensions
      let srcX = 0, srcY = 0, srcW = img.width, srcH = img.height;
      if (cropRect && cropRect.w > 2 && cropRect.h > 2) {
        srcX = Math.round((cropRect.x / 100) * img.width);
        srcY = Math.round((cropRect.y / 100) * img.height);
        srcW = Math.round((cropRect.w / 100) * img.width);
        srcH = Math.round((cropRect.h / 100) * img.height);
      }

      // Determine rotated canvas dimensions
      const isRotatedOrtho = rotation === 90 || rotation === 270;
      const outWidth = isRotatedOrtho ? srcH : srcW;
      const outHeight = isRotatedOrtho ? srcW : srcH;

      canvas.width = outWidth;
      canvas.height = outHeight;

      ctx.clearRect(0, 0, outWidth, outHeight);
      ctx.save();
      ctx.translate(outWidth / 2, outHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // Filters
      let filterString = 'none';
      if (filter === 'grayscale') filterString = 'grayscale(100%)';
      else if (filter === 'sepia') filterString = 'sepia(100%)';
      else if (filter === 'brightness') filterString = 'brightness(130%)';
      else if (filter === 'blur') filterString = 'blur(2px)';
      ctx.filter = filterString;

      // Draw original cropped image region centered inside rotated container
      ctx.drawImage(img, srcX, srcY, srcW, srcH, -srcW / 2, -srcH / 2, srcW, srcH);
      ctx.restore();

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            onSave(blob, dataUrl);
            onClose();
          } else {
            alert('Failed to process edited image.');
          }
          setProcessing(false);
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => {
      setProcessing(false);
      alert('Error loading image for client-side editing.');
    };
  };

  const getPreviewStyle = (): React.CSSProperties => {
    let filterString = '';
    if (filter === 'grayscale') filterString = 'grayscale(100%)';
    else if (filter === 'sepia') filterString = 'sepia(100%)';
    else if (filter === 'brightness') filterString = 'brightness(1.3)';
    else if (filter === 'blur') filterString = 'blur(2px)';

    return {
      transform: `rotate(${rotation}deg)`,
      filter: filterString || undefined,
      transition: 'transform 0.25s ease, filter 0.25s ease',
      maxHeight: '340px',
      maxWidth: '100%',
      objectFit: 'contain' as const,
      borderRadius: '8px',
      display: 'block',
      margin: '0 auto',
      pointerEvents: 'none',
      userSelect: 'none',
    };
  };

  const filterOptions: { value: PhotoFilter; label: string }[] = [
    { value: 'none', label: 'Normal' },
    { value: 'grayscale', label: 'Grayscale' },
    { value: 'sepia', label: 'Sepia' },
    { value: 'brightness', label: 'Bright' },
    { value: 'blur', label: 'Blur' },
  ];

  return (
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal-panel" style={{ maxWidth: '580px', maxHeight: '95vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3 className="flex items-center gap-2">
            <Sliders size={18} />
            Edit Photo
          </h3>
          <button onClick={onClose} className="modal-close-btn" disabled={processing} aria-label="Cancel edit">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Preview Window */}
          <div
            ref={imageContainerRef}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            style={{
              background: '#0a0a0c',
              borderRadius: '12px',
              padding: '1.5rem',
              minHeight: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
              userSelect: 'none',
              touchAction: cropMode ? 'none' : 'auto',
            }}
          >
            <img 
              ref={imageRef} 
              src={imageUrl} 
              alt="Edit preview" 
              style={getPreviewStyle()} 
              draggable={false} 
              onLoad={updateImageBounds}
            />

            {/* Crop overlay boundaries tied strictly to the imgPos (rendered image aspect box) */}
            {cropMode && cropRect && imgPos && (
              <div
                style={{
                  position: 'absolute',
                  left: `${imgPos.left}px`,
                  top: `${imgPos.top}px`,
                  width: `${imgPos.width}px`,
                  height: `${imgPos.height}px`,
                  pointerEvents: 'none',
                }}
              >
                {/* Backdrop outside the crop area */}
                {/* Top */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: `${cropRect.y}%`, background: 'rgba(0,0,0,0.65)',
                }} />
                {/* Bottom */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: `${100 - cropRect.y - cropRect.h}%`, background: 'rgba(0,0,0,0.65)',
                }} />
                {/* Left */}
                <div style={{
                  position: 'absolute', top: `${cropRect.y}%`, left: 0,
                  width: `${cropRect.x}%`, height: `${cropRect.h}%`, background: 'rgba(0,0,0,0.65)',
                }} />
                {/* Right */}
                <div style={{
                  position: 'absolute', top: `${cropRect.y}%`, right: 0,
                  width: `${100 - cropRect.x - cropRect.w}%`, height: `${cropRect.h}%`, background: 'rgba(0,0,0,0.65)',
                }} />

                {/* Resizable crop box */}
                <div
                  onMouseDown={(e) => handlePointerDown(e, 'move')}
                  onTouchStart={(e) => handlePointerDown(e, 'move')}
                  style={{
                    position: 'absolute',
                    top: `${cropRect.y}%`,
                    left: `${cropRect.x}%`,
                    width: `${cropRect.w}%`,
                    height: `${cropRect.h}%`,
                    border: '2px solid #6366f1',
                    boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0)',
                    cursor: 'move',
                    pointerEvents: 'auto',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Aspect Grid lines for Rule of Thirds */}
                  <div style={{ position: 'absolute', left: '33.3%', top: 0, bottom: 0, width: '1px', borderLeft: '1px dashed rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', left: '66.6%', top: 0, bottom: 0, width: '1px', borderLeft: '1px dashed rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', top: '33.3%', left: 0, right: 0, height: '1px', borderTop: '1px dashed rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', top: '66.6%', left: 0, right: 0, height: '1px', borderTop: '1px dashed rgba(255,255,255,0.35)', pointerEvents: 'none' }} />

                  {/* Circular preview indicator for avatars / 1:1 crops (YouTube/WhatsApp style) */}
                  {aspectRatio === '1:1' && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: '50%',
                      border: '2px solid rgba(255, 255, 255, 0.85)',
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)',
                      pointerEvents: 'none',
                      boxSizing: 'border-box',
                    }} />
                  )}

                  {/* Drag handles (larger, mobile friendly size: 14x14px with expanded hit area) */}
                  {/* Corners */}
                  <div
                    onMouseDown={(e) => handlePointerDown(e, 'nw')}
                    onTouchStart={(e) => handlePointerDown(e, 'nw')}
                    style={{ position: 'absolute', top: '-6px', left: '-6px', width: '16px', height: '16px', borderLeft: '4px solid #6366f1', borderTop: '4px solid #6366f1', cursor: 'nwse-resize' }}
                  />
                  <div
                    onMouseDown={(e) => handlePointerDown(e, 'ne')}
                    onTouchStart={(e) => handlePointerDown(e, 'ne')}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', width: '16px', height: '16px', borderRight: '4px solid #6366f1', borderTop: '4px solid #6366f1', cursor: 'nesw-resize' }}
                  />
                  <div
                    onMouseDown={(e) => handlePointerDown(e, 'se')}
                    onTouchStart={(e) => handlePointerDown(e, 'se')}
                    style={{ position: 'absolute', bottom: '-6px', right: '-6px', width: '16px', height: '16px', borderRight: '4px solid #6366f1', borderBottom: '4px solid #6366f1', cursor: 'nwse-resize' }}
                  />
                  <div
                    onMouseDown={(e) => handlePointerDown(e, 'sw')}
                    onTouchStart={(e) => handlePointerDown(e, 'sw')}
                    style={{ position: 'absolute', bottom: '-6px', left: '-6px', width: '16px', height: '16px', borderLeft: '4px solid #6366f1', borderBottom: '4px solid #6366f1', cursor: 'nesw-resize' }}
                  />

                  {/* Edges */}
                  <div
                    onMouseDown={(e) => handlePointerDown(e, 'n')}
                    onTouchStart={(e) => handlePointerDown(e, 'n')}
                    style={{ position: 'absolute', top: '-6px', left: '16px', right: '16px', height: '10px', cursor: 'ns-resize' }}
                  />
                  <div
                    onMouseDown={(e) => handlePointerDown(e, 's')}
                    onTouchStart={(e) => handlePointerDown(e, 's')}
                    style={{ position: 'absolute', bottom: '-6px', left: '16px', right: '16px', height: '10px', cursor: 'ns-resize' }}
                  />
                  <div
                    onMouseDown={(e) => handlePointerDown(e, 'w')}
                    onTouchStart={(e) => handlePointerDown(e, 'w')}
                    style={{ position: 'absolute', left: '-6px', top: '16px', bottom: '16px', width: '10px', cursor: 'ew-resize' }}
                  />
                  <div
                    onMouseDown={(e) => handlePointerDown(e, 'e')}
                    onTouchStart={(e) => handlePointerDown(e, 'e')}
                    style={{ position: 'absolute', right: '-6px', top: '16px', bottom: '16px', width: '10px', cursor: 'ew-resize' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                const nextMode = !cropMode;
                setCropMode(nextMode);
                if (nextMode) {
                  setRotation(0); // Clear rotation for easier cropping
                  // Start with default "Free" crop boundary
                  initDefaultCrop(aspectRatio);
                } else {
                  setCropRect(null);
                }
              }}
              style={{
                display: 'flex', gap: '0.4rem',
                background: cropMode ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-hover)',
                color: cropMode ? '#818cf8' : 'var(--text-main)',
                border: cropMode ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-color)',
              }}
            >
              <Crop size={14} />
              {cropMode ? 'Cropping…' : 'Crop'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleRotate}
              disabled={cropMode} // Crop must be unrotated for accurate mapping
              style={{
                display: 'flex', gap: '0.4rem',
                background: 'var(--bg-hover)',
                color: cropMode ? 'var(--text-muted)' : 'var(--text-main)',
                border: '1px solid var(--border-color)',
                opacity: cropMode ? 0.5 : 1,
              }}
            >
              <RotateCw size={14} />
              Rotate 90°
            </button>
            {cropRect && (
              <button
                type="button"
                className="btn"
                onClick={handleClearCrop}
                style={{
                  display: 'flex', gap: '0.4rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  fontSize: '0.75rem',
                }}
              >
                <X size={13} />
                Clear Crop
              </button>
            )}
          </div>

          {/* Aspect Ratio Presets (Only visible in crop mode) */}
          {cropMode && (
            <div style={{ textAlign: 'center' }}>
              <span className="cp-field-label" style={{ marginBottom: '0.4rem', display: 'block', fontSize: '0.75rem' }}>Aspect Ratio</span>
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                {(['free', '1:1', '4:3', '16:9'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    className="btn"
                    onClick={() => {
                      setAspectRatio(ratio);
                      initDefaultCrop(ratio);
                    }}
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.25rem 0.65rem',
                      background: aspectRatio === ratio ? 'var(--accent-primary)' : 'var(--bg-hover)',
                      color: aspectRatio === ratio ? 'white' : 'var(--text-muted)',
                      border: '1px solid var(--border-color)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters List */}
          <div>
            <span className="cp-field-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Filters</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {filterOptions.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className="btn"
                  onClick={() => setFilter(f.value)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.75rem',
                    background: filter === f.value ? 'var(--accent-primary)' : 'var(--bg-hover)',
                    color: filter === f.value ? 'white' : 'var(--text-muted)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas placeholder */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Save / Cancel buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={processing}
              style={{ background: 'transparent', color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApply}
              disabled={processing}
              style={{ minWidth: '100px' }}
            >
              {processing ? 'Saving...' : 'Apply Edits'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
