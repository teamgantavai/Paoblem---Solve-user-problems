'use client';

import React, { useState } from 'react';
import { User } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export default function Avatar({ src, name = 'User', size = 42, className, onClick, style }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;

  if (showImage) {
    return (
      <img
        src={src!}
        alt={name}
        onError={() => setFailed(true)}
        onClick={onClick}
        className={className}
        style={!className ? {
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          display: 'block',
          cursor: onClick ? 'pointer' : 'default',
          ...style
        } : {
          cursor: onClick ? 'pointer' : 'default',
          ...style
        }}
      />
    );
  }

  // Fallback to User icon
  return (
    <div
      onClick={onClick}
      className={className}
      aria-label={name}
      style={!className ? {
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--bg-hover)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        ...style
      } : {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
    >
      <User size={Math.max(12, Math.floor(size * 0.52))} />
    </div>
  );
}
