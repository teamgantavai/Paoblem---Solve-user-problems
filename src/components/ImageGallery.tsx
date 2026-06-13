'use client';

import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import ImageViewerModal from './ImageViewerModal';

interface ImageGalleryProps {
  imageUrlsString: string | null | undefined;
}

export default function ImageGallery({ imageUrlsString }: ImageGalleryProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Parse list of image URLs from the string
  const parseImages = (): string[] => {
    if (!imageUrlsString) return [];
    
    // Check if it's a JSON array
    const trimmed = imageUrlsString.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(url => typeof url === 'string' && url.length > 0);
        }
      } catch (e) {
        console.error('Failed to parse image gallery JSON array:', e);
      }
    }
    
    // Fallback: single image URL
    return [trimmed];
  };

  const images = parseImages();

  if (images.length === 0) return null;

  const handleOpenViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const count = images.length;
  const layoutClass = 
    count === 1 ? 'gallery-layout-1' :
    count === 2 ? 'gallery-layout-2' :
    count === 3 ? 'gallery-layout-3' :
    'gallery-layout-many';

  // We render up to 4 in the grid
  const visibleImages = images.slice(0, 4);
  const extraCount = count - 4;

  return (
    <>
      <div className="gallery-container">
        <div className={`gallery-grid ${layoutClass}`}>
          {visibleImages.map((url, index) => (
            <GalleryItem 
              key={url + '-' + index}
              url={url} 
              index={index} 
              isLast={index === 3 && extraCount > 0}
              extraCount={extraCount}
              onClick={() => handleOpenViewer(index)} 
            />
          ))}
        </div>
      </div>

      <ImageViewerModal 
        isOpen={viewerOpen} 
        onClose={() => setViewerOpen(false)} 
        images={images} 
        initialIndex={viewerIndex} 
      />
    </>
  );
}

interface GalleryItemProps {
  url: string;
  index: number;
  isLast: boolean;
  extraCount: number;
  onClick: () => void;
}

function GalleryItem({ url, index, isLast, extraCount, onClick }: GalleryItemProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div 
        className="gallery-item"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          padding: '1rem',
          height: '100%',
          minHeight: '150px',
          backgroundColor: 'var(--bg-hover)'
        }}
      >
        <ImageIcon size={20} style={{ color: '#ef4444', marginBottom: '0.25rem' }} />
        <span style={{ fontSize: '0.68rem' }}>Image failed to load</span>
      </div>
    );
  }

  return (
    <div className="gallery-item" onClick={onClick}>
      {!loaded && (
        <div 
          className="skeleton-loader" 
          style={{ 
            width: '100%', 
            height: '100%', 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            zIndex: 1,
            backgroundColor: 'var(--bg-hover)'
          }} 
        />
      )}
      
      <img 
        src={url} 
        alt={`Post attachment ${index + 1}`} 
        className="gallery-item-img"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setError(true);
          setLoaded(true);
        }}
        style={{ opacity: loaded ? 1 : 0 }}
      />

      {isLast && (
        <div className="gallery-overlay-more">
          +{extraCount + 1}
        </div>
      )}
    </div>
  );
}
