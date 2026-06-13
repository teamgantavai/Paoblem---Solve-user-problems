'use client';

import React from 'react';
import { ChevronUp, MessageCircle, User, Bell, Radio } from 'lucide-react';
import { Notification } from '@/lib/types';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}

export default function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  const getIcon = () => {
    switch (notification.type) {
      case 'upvote':
        return <ChevronUp size={16} className="notif-icon-vote" />;
      case 'comment':
        return <MessageCircle size={16} className="notif-icon-comment" />;
      case 'follow':
        return <User size={16} className="notif-icon-follow" />;
      default:
        return <Bell size={16} className="notif-icon-system" />;
    }
  };

  const getRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
      if (seconds < 60) return 'Just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div 
      className={`notif-item ${notification.read ? 'read' : 'unread'}`}
      onClick={() => !notification.read && onMarkAsRead(notification.id)}
    >
      <div className="notif-icon-container">
        {getIcon()}
      </div>
      <div className="notif-content-wrap">
        <div className="notif-header">
          <span className="notif-title">{notification.title}</span>
          <span className="notif-time">{getRelativeTime(notification.created_at)}</span>
        </div>
        <p className="notif-body">{notification.body}</p>
      </div>
      {!notification.read && (
        <div className="notif-unread-dot" title="Unread" />
      )}
    </div>
  );
}
