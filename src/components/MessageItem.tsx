'use client';

import React from 'react';
import { Message } from '@/lib/types';

interface MessageItemProps {
  message: Message;
  onMarkAsRead: (id: string) => void;
}

export default function MessageItem({ message, onMarkAsRead }: MessageItemProps) {
  const getRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
      if (seconds < 60) return 'Just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return date.toLocaleDateString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  return (
    <div 
      className={`msg-item ${message.read ? 'read' : 'unread'}`}
      onClick={() => !message.read && onMarkAsRead(message.id)}
    >
      <img 
        src={message.sender_avatar} 
        alt={message.sender_name} 
        className="msg-avatar"
      />
      <div className="msg-content-wrap">
        <div className="msg-header">
          <span className="msg-sender">{message.sender_name}</span>
          <span className="msg-time">{getRelativeTime(message.created_at)}</span>
        </div>
        <p className="msg-body">{message.body}</p>
      </div>
      {!message.read && (
        <div className="msg-unread-dot" title="New Message" />
      )}
    </div>
  );
}
