// Database Types for Supabase

export interface Post {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'problem' | 'idea';
  image_url: string | null;
  external_link: string | null;
  link_name: string | null;
  upvotes: number;
  downvotes: number;
  comments_count: number;
  views_count: number;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
  } | null;
}


export interface Vote {
  id: string;
  user_id: string;
  post_id: string;
  vote_type: 'up' | 'down';
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
  } | null;
}

export interface View {
  id: string;
  user_id: string | null;
  post_id: string;
  ip_address: string | null;
  created_at: string;
}

// API Request/Response Types

export interface CreatePostPayload {
  title: string;
  body: string;
  type: 'problem' | 'idea';
  image_url?: string | null;
  external_link?: string | null;
}

export interface PostsListResponse {
  posts: Post[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface VotePayload {
  post_id: string;
  vote_type: 'up' | 'down';
}

export interface CommentPayload {
  post_id: string;
  body: string;
}

export interface AIEnhanceResponse {
  original: string;
  enhanced: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'upvote' | 'comment' | 'follow' | 'downvote' | 'system';
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  post_id?: string | null;
}

export interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string;
  body: string;
  read: boolean;
  created_at: string;
}

