// Database Types for Supabase

export interface Post {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'problem' | 'idea';
  image_url: string | null;
  video_url?: string | null;
  metadata?: any;
  external_link: string | null;
  link_name: string | null;
  category?: string | null;
  tags?: string[] | null;
  upvotes: number;
  downvotes: number;
  comments_count: number;
  views_count: number;
  solutions_count?: number;
  solved?: boolean;
  slug: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
    username: string | null;
    cover_url?: string | null;
  } | null;
}

export interface Solution {
  id: string;
  problem_id: string;
  user_id: string;
  title: string;
  body: string;
  image_url: string | null;
  external_link: string | null;
  link_name: string | null;
  upvotes: number;
  downvotes: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
    username: string | null;
    cover_url?: string | null;
  } | null;
  problem?: {
    id: string;
    title: string;
    slug: string | null;
    body?: string | null;
    type?: 'problem' | 'idea';
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
  parent_id?: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
    username: string | null;
    cover_url?: string | null;
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
  type: 'upvote' | 'comment' | 'follow' | 'downvote' | 'system' | 'new_post';
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

// Analytics Types

export type PostEventType =
  | 'POST_VIEW'
  | 'POST_OPEN'
  | 'POST_UPVOTE'
  | 'POST_DOWNVOTE'
  | 'POST_COMMENT'
  | 'POST_SHARE'
  | 'POST_SAVE'
  | 'FOLLOW_FROM_POST'
  | 'CHALLENGE_ACCEPT'
  | 'DWELL'
  | 'SOLUTION_VIEW'
  | 'SOLUTION_UPVOTE'
  | 'SOLUTION_SAVE';

export interface PostEvent {
  id: string;
  post_id: string;
  user_id: string | null;
  event_type: PostEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PostAnalyticsDaily {
  id: string;
  post_id: string;
  date: string;
  views: number;
  unique_views: number;
  opens: number;
  upvotes: number;
  downvotes: number;
  comments: number;
  shares: number;
  saves: number;
  follows_gained: number;
}

export interface AnalyticsMetric {
  value: number;
  delta: number;
  sparkline: number[];
}

export interface AnalyticsOverview {
  totalViews: AnalyticsMetric;
  uniqueViews: AnalyticsMetric;
  upvotes: AnalyticsMetric;
  downvotes: AnalyticsMetric;
  comments: AnalyticsMetric;
  shares: AnalyticsMetric;
  saves: AnalyticsMetric;
  followersGained: AnalyticsMetric;
  engagementRate: AnalyticsMetric;
  rankingScore: AnalyticsMetric;
  isDemo: boolean;
}

export interface AnalyticsTimeSeries {
  label: string;
  date: string;
  views: number;
  uniqueViews: number;
  upvotes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface TrafficSource {
  source: string;
  count: number;
  percentage: number;
}

export interface AudienceInsight {
  countries: { name: string; count: number }[];
  cities: { name: string; count: number }[];
  devices: { name: string; count: number; percentage: number }[];
  browsers: { name: string; count: number }[];
  visitorTypes: { name: string; count: number; percentage: number }[];
}

export interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
  conversionFromPrevious: number | null;
}

export interface EngagementBreakdown {
  upvoteRate: number;
  commentRate: number;
  shareRate: number;
  saveRate: number;
  avgReadTimeSeconds: number;
  scrollDepthPercent: number;
}

export interface TopPerformingPost {
  id: string;
  title: string;
  metric: number;
  metricLabel: string;
  trend: number;
  slug: string | null;
}

export interface PostComparisonRow {
  postId: string;
  title: string;
  views: number;
  engagementRate: number;
  comments: number;
  shares: number;
  growthRate: number;
}

export interface AIInsight {
  bestTimeToPost: string;
  performanceReason: string;
  suggestions: string[];
  predictedViewsNext7Days: number[];
}

export interface AnalyticsPostResponse {
  overview: AnalyticsOverview;
  timeSeries: AnalyticsTimeSeries[];
  engagementTrend: AnalyticsTimeSeries[];
  trafficSources: TrafficSource[];
  audience: AudienceInsight;
  funnel: FunnelStage[];
  engagement: EngagementBreakdown;
  heatmap: number[][];
  aiInsights: AIInsight;
  isDemo: boolean;
}

export interface AnalyticsOverviewResponse {
  overview: AnalyticsOverview;
  timeSeries: AnalyticsTimeSeries[];
  topPosts: TopPerformingPost[];
  posts: { id: string; title: string; slug: string | null }[];
  isDemo: boolean;
}

export interface AnalyticsCompareResponse {
  posts: PostComparisonRow[];
  isDemo: boolean;
}

export interface TrackEventPayload {
  post_id: string;
  event_type: PostEventType;
  metadata?: Record<string, unknown>;
}

// Simplified Analytics UI Types

export interface AnalyticsTotals {
  views: number;
  votes: number;
  comments: number;
  followsGained: number;
}

export interface PostGridItem {
  id: string;
  title: string;
  slug: string | null;
  type: 'problem' | 'idea' | 'solution';
  image_url: string | null;
  created_at: string;
  views: number;
  votes: number;
  upvotes?: number;
  downvotes?: number;
  comments: number;
  followsGained: number;
}

export interface AnalyticsGridResponse {
  totals: AnalyticsTotals;
  posts: PostGridItem[];
  isDemo: boolean;
}

export interface PostVoter {
  user_id: string;
  vote_type: 'up' | 'down';
  created_at: string;
  full_name: string;
  avatar_url: string | null;
  username: string | null;
}

export interface DemographicItem {
  name: string;
  count: number;
}

export interface UserDemographics {
  devices: DemographicItem[];
  browsers: DemographicItem[];
  countries: DemographicItem[];
}

export interface PostAnalyticsDetailResponse {
  post: {
    id: string;
    title: string;
    slug: string | null;
    body: string;
    type: 'problem' | 'idea' | 'solution';
    image_url: string | null;
    created_at: string;
  };
  stats: {
    views: number;
    impressions: number;
    upvotes: number;
    downvotes: number;
    comments: number;
    followsGained: number;
  };
  voters: PostVoter[];
  demographics: UserDemographics;
  isDemo: boolean;
}

// ==========================================
// Search Types
// ==========================================

export interface SearchResult {
  id: string;
  title: string;
  body_snippet: string;
  type: 'problem' | 'idea';
  slug: string | null;
  upvotes: number;
  comments_count: number;
  views_count: number;
  created_at: string;
  rank: number;
  author: {
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
  } | null;
}

export interface SearchResultSolution {
  id: string;
  title: string;
  body_snippet: string;
  problem_id: string;
  problem_title: string;
  upvotes: number;
  created_at: string;
  rank: number;
  author: {
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
  } | null;
}

export interface SearchResultUser {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  bio_snippet: string | null;
  rank: number;
}

export interface SearchResponse {
  problems: SearchResult[];
  ideas: SearchResult[];
  solutions: SearchResultSolution[];
  users: SearchResultUser[];
  trending?: TrendingData;
}

export interface TrendingData {
  searches: string[];
  problems: SearchResult[];
  ideas: SearchResult[];
  solutions: SearchResultSolution[];
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  created_at: string;
}

export interface SearchAnalyticsData {
  topSearches: { query: string; count: number }[];
  noResultSearches: { query: string; count: number }[];
  searchToClickRate: number;
  trendingSearches: { query: string; count: number; trend: number }[];
}
