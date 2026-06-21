'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Image as ImageIcon,
  Link2,
  TriangleIcon,
  MessageCircle,
  Bookmark,
  MoreVertical,
  Trash2,
  ExternalLink,
  Pencil,
  Share2,
  Copy,
  Loader2,
  BarChart2,
  Send
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Post, Comment, Solution } from '@/lib/types';
import { trackEvent } from '@/lib/analytics-track';
import AuthModal from './AuthModal';
import EditPostModal from './EditPostModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { decodeHTMLEntities } from '@/lib/htmlDecoder';
import ImageGallery from './ImageGallery';
import ImageUploader from './ImageUploader';
import CommentThread from './CommentThread';
import Avatar from './Avatar';
import { useMicroAnimations } from '@/hooks/useMicroAnimations';
import { useQueryClient } from '@tanstack/react-query';

interface InteractivePostProps {
  initialPost: Post;
  initialComments: Comment[];
}

export default function InteractivePost({ initialPost, initialComments }: InteractivePostProps) {
  const { animateUpvote } = useMicroAnimations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightComment = searchParams ? searchParams.get('highlightComment') : null;
  const queryClient = useQueryClient();

  const [post, setPost] = useState<Post>(initialPost);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [session, setSession] = useState<any>(null);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [userSolutionVotes, setUserSolutionVotes] = useState<Record<string, 'up' | 'down'>>({});
  const [votingSolutionIds, setVotingSolutionIds] = useState<Record<string, boolean>>({});
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [isSolutionsLoading, setIsSolutionsLoading] = useState(false);
  const [solutionTitle, setSolutionTitle] = useState('');
  const [solutionBody, setSolutionBody] = useState('');
  const [solutionLink, setSolutionLink] = useState('');
  const [solutionImageUrls, setSolutionImageUrls] = useState<string[]>([]);
  const [isSubmittingSolution, setIsSubmittingSolution] = useState(false);
  const [isSolutionModalOpen, setIsSolutionModalOpen] = useState(false);
  const [editingSolutionId, setEditingSolutionId] = useState<string | null>(null);
  
  // Modals & Popovers state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isEditPostOpen, setIsEditPostOpen] = useState(false);
  const [isDeletePostOpen, setIsDeletePostOpen] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [activeShareMenu, setActiveShareMenu] = useState(false);
  const [showSubShare, setShowSubShare] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const postRef = useRef<HTMLElement>(null);
  const viewTrackedRef = useRef(false);
  const viewedSolutionIdsRef = useRef<Set<string>>(new Set());

  // Edit Comment State - handled by CommentThread

  // Load Session and Votes on Mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user?.id) {
        fetchUserVote(currentSession.user.id);
        fetchUserSolutionVotes(currentSession.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user?.id) {
        fetchUserVote(currentSession.user.id);
        fetchUserSolutionVotes(currentSession.user.id);
      } else {
        setUserVote(null);
        setUserSolutionVotes({});
      }
    });

    // Load saved bookmarks
    const saved = localStorage.getItem('paoblem_saved_posts');
    if (saved) {
      try {
        setSavedIds(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }

    return () => subscription.unsubscribe();
  }, []);

  // Track post open on detail page load
  useEffect(() => {
    trackEvent(post.id, 'POST_OPEN', session?.access_token);
  }, [post.id, session?.access_token]);

  // Track post view when visible in viewport
  useEffect(() => {
    if (!postRef.current || viewTrackedRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !viewTrackedRef.current) {
          viewTrackedRef.current = true;
          trackEvent(post.id, 'POST_VIEW', session?.access_token);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(postRef.current);
    return () => observer.disconnect();
  }, [post.id, session?.access_token]);

  // Highlight and scroll to comment
  useEffect(() => {
    if (highlightComment && comments.length > 0) {
      const matchedComment = comments.find(
        c => c.id === highlightComment || c.profiles?.username === highlightComment
      );
      if (matchedComment) {
        const timer = setTimeout(() => {
          const element = document.getElementById(`comment-${matchedComment.id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.style.transition = 'background-color 0.5s ease';
            element.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
            setTimeout(() => {
              element.style.backgroundColor = 'transparent';
            }, 3000);
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightComment, comments]);

  const fetchUserVote = async (userId: string) => {
    if (post.id === 'dylan-post' || post.id === 'ryan-post') return;
    try {
      const { data, error } = await supabase
        .from('votes')
        .select('vote_type')
        .eq('user_id', userId)
        .eq('post_id', post.id)
        .maybeSingle();
      if (data) {
        setUserVote(data.vote_type as 'up' | 'down');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUserSolutionVotes = async (userId: string) => {
    if (post.id === 'dylan-post' || post.id === 'ryan-post') return;
    try {
      const { data } = await supabase
        .from('solution_votes')
        .select('solution_id, vote_type')
        .eq('user_id', userId);
      if (data && data.length > 0) {
        const map: Record<string, 'up' | 'down'> = {};
        data.forEach((v: any) => { map[v.solution_id] = v.vote_type as 'up' | 'down'; });
        setUserSolutionVotes(map);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  useEffect(() => {
    if (post.type === 'problem') {
      fetchSolutions();
    }
  }, [post.id, post.type]);

  async function fetchSolutions(): Promise<Solution[]> {
    if (post.id === 'dylan-post') {
      const mockSolutions: Solution[] = [
        {
          id: 'mock-solution-1',
          problem_id: post.id,
          user_id: 'user-ryan',
          title: 'Create a shared design-to-code handoff workspace',
          body: 'A practical fix is a collaborative workspace where components, tokens, redlines, and implementation notes live together instead of being passed across tools.',
          image_url: null,
          external_link: 'https://figma.com',
          link_name: 'Reference workflow',
          upvotes: 28,
          downvotes: 1,
          comments_count: 4,
          created_at: new Date(Date.now() - 1000 * 3600 * 12).toISOString(),
          updated_at: new Date(Date.now() - 1000 * 3600 * 12).toISOString(),
          profiles: {
            full_name: 'Ryan Roslansky',
            avatar_url: 'https://i.pravatar.cc/150?u=ryan2',
            role: 'Developer',
            username: 'ryan_roslansky',
          },
        },
      ];
      setSolutions(mockSolutions);
      return mockSolutions;
    }

    setIsSolutionsLoading(true);
    try {
      const res = await fetch(`/api/solutions?problemId=${encodeURIComponent(post.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load solutions');
      const nextSolutions = data.solutions || [];
      setSolutions(nextSolutions);
      return nextSolutions;
    } catch (err) {
      console.error(err);
      setSolutions([]);
      return [];
    } finally {
      setIsSolutionsLoading(false);
    }
  }

  const trackSolutionEvent = async (solutionId: string, eventType: 'SOLUTION_VIEW' | 'SOLUTION_SAVE') => {
    if (!solutionId.startsWith('mock-')) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        await fetch('/api/solutions/track', {
          method: 'POST',
          headers,
          body: JSON.stringify({ solution_id: solutionId, event_type: eventType }),
        });
      } catch {
        // Non-blocking analytics.
      }
    }
  };

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-solution-id]'));
    if (cards.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const solutionId = (entry.target as HTMLElement).dataset.solutionId;
        if (!solutionId || !entry.isIntersecting || viewedSolutionIdsRef.current.has(solutionId)) return;
        viewedSolutionIdsRef.current.add(solutionId);
        trackSolutionEvent(solutionId, 'SOLUTION_VIEW');
      });
    }, { threshold: 0.55 });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [solutions.map((solution) => solution.id).join(','), session?.access_token]);

  const handleSubmitSolution = async () => {
    if (!session) {
      setIsAuthOpen(true);
      return;
    }
    if (!solutionTitle.trim() || solutionBody.trim().length < 10) {
      showToast('Add a title and a useful solution.');
      return;
    }

    setIsSubmittingSolution(true);
    try {
      const rawLink = solutionLink.trim();
      const formattedLink = rawLink ? (/^https?:\/\//i.test(rawLink) ? rawLink : `https://${rawLink}`) : null;
      const payload = {
        title: solutionTitle.trim(),
        body: solutionBody.trim(),
        image_url: solutionImageUrls.length > 0 ? JSON.stringify(solutionImageUrls) : null,
        external_link: formattedLink,
        link_name: formattedLink ? 'Solution link' : null,
      };
      const res = await fetch('/api/solutions', {
        method: editingSolutionId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(editingSolutionId ? { ...payload, id: editingSolutionId } : { ...payload, problem_id: post.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish solution');

      const refreshedSolutions = await fetchSolutions();
      setPost((prev) => ({
        ...prev,
        solutions_count: refreshedSolutions.length || (prev.solutions_count || 0) + 1,
        solved: true,
      }));
      setSolutionTitle('');
      setSolutionBody('');
      setSolutionLink('');
      setSolutionImageUrls([]);
      setEditingSolutionId(null);
      setIsSolutionModalOpen(false);
      showToast(editingSolutionId ? 'Solution updated.' : 'Solution published.');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to publish solution');
    } finally {
      setIsSubmittingSolution(false);
    }
  };

  const openCreateSolutionModal = () => {
    setEditingSolutionId(null);
    setSolutionTitle('');
    setSolutionBody('');
    setSolutionLink('');
    setSolutionImageUrls([]);
    setIsSolutionModalOpen(true);
  };

  const openEditSolutionModal = (solution: Solution) => {
    setEditingSolutionId(solution.id);
    setSolutionTitle(decodeHTMLEntities(solution.title));
    setSolutionBody(decodeHTMLEntities(solution.body));
    setSolutionLink(solution.external_link || '');
    try {
      const parsedImages = solution.image_url ? JSON.parse(solution.image_url) : [];
      setSolutionImageUrls(Array.isArray(parsedImages) ? parsedImages : []);
    } catch {
      setSolutionImageUrls(solution.image_url ? [solution.image_url] : []);
    }
    setIsSolutionModalOpen(true);
  };

  const handleSolutionVote = async (solutionId: string, voteType: 'up' | 'down') => {
    if (!session) {
      setIsAuthOpen(true);
      return;
    }
    if (votingSolutionIds[solutionId]) return;

    setVotingSolutionIds((prev) => ({ ...prev, [solutionId]: true }));
    const previousVote = userSolutionVotes[solutionId] || null;
    const isToggleOff = previousVote === voteType;

    // Optimistic UI for vote state
    setUserSolutionVotes((prev) => {
      const next = { ...prev };
      if (isToggleOff) { delete next[solutionId]; } else { next[solutionId] = voteType; }
      return next;
    });

    // Optimistic UI for counts
    setSolutions((prev) =>
      prev.map((solution) => {
        if (solution.id !== solutionId) return solution;
        let upDelta = 0;
        let downDelta = 0;
        if (isToggleOff) {
          if (voteType === 'up') upDelta = -1; else downDelta = -1;
        } else if (previousVote) {
          if (voteType === 'up') { upDelta = 1; downDelta = -1; } else { upDelta = -1; downDelta = 1; }
        } else {
          if (voteType === 'up') upDelta = 1; else downDelta = 1;
        }
        return {
          ...solution,
          upvotes: Math.max(0, solution.upvotes + upDelta),
          downvotes: Math.max(0, solution.downvotes + downDelta),
        };
      })
    );

    try {
      const res = await fetch('/api/solutions/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ solution_id: solutionId, vote_type: voteType }),
      });
      if (!res.ok) throw new Error('Vote failed');
    } catch (err) {
      console.error(err);
      fetchSolutions();
      if (session?.user?.id) fetchUserSolutionVotes(session.user.id);
    } finally {
      setVotingSolutionIds((prev) => ({ ...prev, [solutionId]: false }));
    }
  };

  // Close share menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveShareMenu(false);
      setShowSubShare(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleToggleSave = () => {
    let nextSaved: string[];
    if (savedIds.includes(post.id)) {
      nextSaved = savedIds.filter(id => id !== post.id);
      showToast('Post removed from Saved');
    } else {
      nextSaved = [...savedIds, post.id];
      showToast('Post saved successfully');
    }
    setSavedIds(nextSaved);
    localStorage.setItem('paoblem_saved_posts', JSON.stringify(nextSaved));
    if (!savedIds.includes(post.id)) {
      trackEvent(post.id, 'POST_SAVE', session?.access_token);
    }
  };

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!session) {
      setIsAuthOpen(true);
      return;
    }
    // Prevent spam/double clicks
    if (isVoting) return;

    // Trivial local update for mock posts
    if (post.id === 'dylan-post' || post.id === 'ryan-post') {
      setUserVote(prev => prev === voteType ? null : voteType);
      setPost(prev => {
        let upDelta = 0;
        let downDelta = 0;
        if (userVote === voteType) {
          if (voteType === 'up') upDelta = -1;
          else downDelta = -1;
        } else if (userVote) {
          if (voteType === 'up') { upDelta = 1; downDelta = -1; }
          else { upDelta = -1; downDelta = 1; }
        } else {
          if (voteType === 'up') upDelta = 1;
          else downDelta = 1;
        }
        return {
          ...prev,
          upvotes: Math.max(0, prev.upvotes + upDelta),
          downvotes: Math.max(0, prev.downvotes + downDelta)
        };
      });
      return;
    }

    setIsVoting(true);

    // Compute deltas before mutating state
    const previousVote = userVote;
    const isToggleOff = userVote === voteType;
    const newVote = isToggleOff ? null : voteType;

    let upDelta = 0;
    let downDelta = 0;
    if (previousVote === voteType) {
      if (voteType === 'up') upDelta = -1;
      else downDelta = -1;
    } else if (previousVote) {
      if (voteType === 'up') { upDelta = 1; downDelta = -1; }
      else { upDelta = -1; downDelta = 1; }
    } else {
      if (voteType === 'up') upDelta = 1;
      else downDelta = 1;
    }

    // Perform optimistic update on detail page
    setUserVote(newVote);
    setPost(prev => ({
      ...prev,
      upvotes: Math.max(0, prev.upvotes + upDelta),
      downvotes: Math.max(0, prev.downvotes + downDelta)
    }));

    // Sync the feed's React Query cache so navigating back shows updated count
    queryClient.setQueriesData({ queryKey: ['posts'] }, (oldData: any) => {
      if (!oldData?.pages) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          posts: page.posts.map((p: any) =>
            p.id === post.id
              ? { ...p, upvotes: Math.max(0, p.upvotes + upDelta), downvotes: Math.max(0, p.downvotes + downDelta) }
              : p
          )
        }))
      };
    });

    try {
      const res = await fetch('/api/posts/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ post_id: post.id, vote_type: voteType }),
      });
      if (!res.ok) throw new Error('Vote failed');
      trackEvent(post.id, voteType === 'up' ? 'POST_UPVOTE' : 'POST_DOWNVOTE', session.access_token);
    } catch (err) {
      console.error(err);
      // Revert optimistic update on detail page
      setUserVote(previousVote);
      setPost(prev => ({
        ...prev,
        upvotes: Math.max(0, prev.upvotes - upDelta),
        downvotes: Math.max(0, prev.downvotes - downDelta)
      }));
      // Revert feed cache
      queryClient.setQueriesData({ queryKey: ['posts'] }, (oldData: any) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            posts: page.posts.map((p: any) =>
              p.id === post.id
                ? { ...p, upvotes: Math.max(0, p.upvotes - upDelta), downvotes: Math.max(0, p.downvotes - downDelta) }
                : p
            )
          }))
        };
      });
    } finally {
      setIsVoting(false);
    }
  };

  const handleAddComment = async (body: string, parentId?: string | null) => {
    if (!session) {
      setIsAuthOpen(true);
      return;
    }

    if (post.id === 'dylan-post' || post.id === 'ryan-post') {
      const mockComment: Comment = {
        id: `mock-comment-${Date.now()}`,
        post_id: post.id,
        parent_id: parentId || null,
        user_id: session.user.id,
        body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profiles: {
          full_name: session.user.user_metadata?.full_name || 'Member',
          avatar_url: session.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${session.user.id}`,
          role: session.user.user_metadata?.role || 'Innovator',
          username: session.user.user_metadata?.username || null,
        } as any,
      };
      setComments((prev) => [...prev, mockComment]);
      setPost((prev) => ({ ...prev, comments_count: prev.comments_count + 1 }));
      return;
    }

    const res = await fetch('/api/posts/comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        post_id: post.id,
        body,
        parent_id: parentId || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit comment');

    const newComment: Comment = {
      ...data.comment,
      profiles: {
        full_name: session.user.user_metadata?.full_name || 'Member',
        avatar_url:
          session.user.user_metadata?.avatar_url ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${session.user.id}`,
        role: session.user.user_metadata?.role || 'Innovator',
        username: session.user.user_metadata?.username || null,
      },
    };

    setComments((prev) => [...prev, newComment]);
    setPost((prev) => ({ ...prev, comments_count: prev.comments_count + 1 }));
    if (!parentId) {
      trackEvent(post.id, 'POST_COMMENT', session.access_token);
    }
  };

  const handleEditComment = async (commentId: string, body: string) => {
    if (!body.trim()) return;

    const { error } = await supabase
      .from('comments')
      .update({ body: body.trim(), updated_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('user_id', session.user.id);

    if (error) throw error;

    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, body: body.trim(), updated_at: new Date().toISOString() } : c
      )
    );
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', session.user.id);

      if (error) throw error;

      setComments(prev => prev.filter(c => c.id !== commentId));
      setPost(prev => ({ ...prev, comments_count: Math.max(0, prev.comments_count - 1) }));
    } catch (err: any) {
      alert(err.message || 'Failed to delete comment');
    }
  };

  const handleDeletePost = async () => {
    if (!session) return;
    setIsDeletingPost(true);

    try {
      const res = await fetch(`/api/posts/delete?id=${post.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      });
      if (!res.ok) throw new Error('Delete failed');
      router.push('/');
    } catch (err: any) {
      alert(err.message || 'Failed to delete post');
    } finally {
      setIsDeletingPost(false);
      setIsDeletePostOpen(false);
    }
  };

  const isOwner = session?.user?.id === post.user_id;
  const authorProfile = post.profiles;
  const authorName = authorProfile?.full_name || 'Anonymous';
  const authorAvatar = authorProfile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.user_id}`;
  const authorRole = authorProfile?.role || 'Innovator';
  const authorUsername = authorProfile?.username;

  return (
    <article ref={postRef} className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      {/* Dynamic Header */}
      <div className="post-header" style={{ marginBottom: '1rem' }}>
        <div className="post-user">
          <Avatar
            src={authorProfile?.avatar_url}
            name={authorName}
            className="avatar"
            size={42}
            onClick={() => router.push(authorUsername ? `/user/${authorUsername}` : `/profile?userId=${post.user_id}`)}
            style={{ cursor: 'pointer', flexShrink: 0, width: '42px', height: '42px', borderRadius: '50%' }}
          />
          <div className="post-user-info">
            <h4
              className="flex items-center gap-2"
              style={{ fontWeight: 600, cursor: 'pointer', fontSize: '0.92rem' }}
              onClick={() => router.push(authorUsername ? `/user/${authorUsername}` : `/profile?userId=${post.user_id}`)}
            >
              {authorName}
              <span className="post-author-role">
                {authorRole}
              </span>
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {new Date(post.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>

        {/* Options and Share dropdown */}
        <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)', position: 'relative' }}>
          <button
            onClick={handleToggleSave}
            style={{
              background: 'transparent',
              border: 'none',
              color: savedIds.includes(post.id) ? 'var(--accent-blue)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              padding: '6px',
              borderRadius: '50%'
            }}
            className="theme-toggle-btn"
            title={savedIds.includes(post.id) ? "Unsave Post" : "Save Post"}
          >
            <Bookmark size={18} fill={savedIds.includes(post.id) ? "currentColor" : "none"} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveShareMenu(!activeShareMenu);
              setShowSubShare(false);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              padding: '6px',
              borderRadius: '50%'
            }}
            className="theme-toggle-btn"
            title="More Options"
          >
            <MoreVertical size={18} />
          </button>

          {activeShareMenu && (
            <div
              className="share-dropdown-menu"
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'absolute', top: '34px', right: 0, zIndex: 100 }}
            >
              {!showSubShare ? (
                <>
                  <button
                    className="share-menu-item"
                    onClick={() => setShowSubShare(true)}
                  >
                    <Share2 size={13} /> Share Post…
                  </button>

                  {isOwner && (
                    <>
                      <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                      <button
                        className="share-menu-item"
                        onClick={() => {
                          setActiveShareMenu(false);
                          setIsEditPostOpen(true);
                        }}
                        style={{ color: 'var(--accent-blue)' }}
                      >
                        <Pencil size={13} /> Edit Post
                      </button>
                      <button
                        className="share-menu-item"
                        onClick={() => {
                          setActiveShareMenu(false);
                          setIsDeletePostOpen(true);
                        }}
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 size={13} /> Delete Post
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <button
                    className="share-menu-item"
                    onClick={() => setShowSubShare(false)}
                    style={{ fontWeight: 600, color: 'var(--text-muted)' }}
                  >
                    ← Back
                  </button>
                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '2px 0' }} />
                  <button
                    className="share-menu-item"
                    onClick={() => {
                      setActiveShareMenu(false);
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(post.title + '\n' + window.location.origin + '/post/' + post.slug)}`, '_blank');
                      trackEvent(post.id, 'POST_SHARE', session?.access_token, { platform: 'whatsapp' });
                    }}
                  >
                    💬 WhatsApp
                  </button>
                  <button
                    className="share-menu-item"
                    onClick={() => {
                      setActiveShareMenu(false);
                      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin + '/post/' + post.slug)}`, '_blank');
                      trackEvent(post.id, 'POST_SHARE', session?.access_token, { platform: 'linkedin' });
                    }}
                  >
                    💼 LinkedIn
                  </button>
                  <button
                    className="share-menu-item"
                    onClick={() => {
                      setActiveShareMenu(false);
                      window.open(`https://reddit.com/submit?url=${encodeURIComponent(window.location.origin + '/post/' + post.slug)}&title=${encodeURIComponent(post.title)}`, '_blank');
                      trackEvent(post.id, 'POST_SHARE', session?.access_token, { platform: 'reddit' });
                    }}
                  >
                    👽 Reddit
                  </button>
                  <button
                    className="share-menu-item"
                    onClick={() => {
                      setActiveShareMenu(false);
                      const shareUrl = `${window.location.origin}/post/${post.slug}`;
                      navigator.clipboard.writeText(shareUrl);
                      showToast('Link copied!');
                      trackEvent(post.id, 'POST_SHARE', session?.access_token, { platform: 'copy' });
                    }}
                  >
                    <Copy size={13} /> Copy Link
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Title (H1) and Content */}
      <div className="post-content">
        {post.external_link && (
          <a
            href={post.external_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1"
            style={{
              color: 'var(--accent-blue)',
              fontSize: '0.8rem',
              fontWeight: 500,
              marginBottom: '0.6rem',
              textDecoration: 'none',
              display: 'inline-flex'
            }}
          >
            <ExternalLink size={12} />
            <span>{post.link_name || post.external_link}</span>
          </a>
        )}
        <h1 style={{
          fontSize: '1.6rem',
          fontWeight: 700,
          letterSpacing: '-0.015em',
          lineHeight: '1.3',
          marginBottom: '0.8rem',
          color: 'var(--text-main)',
          wordBreak: 'break-word',
          overflowWrap: 'break-word'
        }}>
          {decodeHTMLEntities(post.title)}
        </h1>
        
        <p style={{
          fontSize: '0.94rem',
          lineHeight: '1.6',
          color: 'var(--text-main)',
          whiteSpace: 'pre-wrap',
          marginBottom: '1.25rem',
          wordBreak: 'break-word'
        }}>
          {post.body}
        </p>
      </div>

      {/* Attachments */}
      <ImageGallery imageUrlsString={post.image_url} />

      {/* Post Footer Actions */}
      <div className="post-footer" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
        <div className="flex items-center gap-2">
          {/* Upvote Capsule */}
          <div className="vote-container" style={{ borderColor: userVote === 'up' ? '#22c55e' : undefined, background: userVote === 'up' ? 'rgba(34, 197, 94, 0.08)' : undefined }}>
            <button
              className="vote-btn"
              onClick={(e) => {
                animateUpvote(e.currentTarget);
                handleVote('up');
              }}
              style={{ color: userVote === 'up' ? '#22c55e' : undefined }}
              aria-label="Upvote"
            >
              <TriangleIcon size={16} fill={userVote === 'up' ? 'currentColor' : 'none'} />
            </button>
            <span className={`vote-label up ${userVote === 'up' ? 'active' : ''}`} style={{ color: userVote === 'up' ? '#22c55e' : undefined }}>
              +{post.upvotes}
            </span>
          </div>

          {/* Downvote Capsule */}
          <div className="vote-container" style={{ borderColor: userVote === 'down' ? '#ef4444' : undefined, background: userVote === 'down' ? 'rgba(239, 68, 68, 0.08)' : undefined }}>
            <button
              className="vote-btn"
              onClick={() => {
                handleVote('down');
              }}
              style={{ color: userVote === 'down' ? '#ef4444' : undefined }}
              aria-label="Downvote"
            >
              <TriangleIcon size={16} style={{ transform: 'rotate(180deg)' }} fill={userVote === 'down' ? 'currentColor' : 'none'} />
            </button>
            <span className={`vote-label down ${userVote === 'down' ? 'active' : ''}`}>
              -{post.downvotes}
            </span>
          </div>

          {/* Comments Count */}
          <div
            style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: '0.5rem', color: 'var(--text-main)' }}
            aria-label="Comments"
          >
            <MessageCircle size={19} />
            <span className="comment-count-badge" style={{ background: 'var(--text-main)', color: 'var(--bg-dark)' }}>
              {post.comments_count}
            </span>
          </div>

          {/* Post Type Sticker */}
          <span className={`sticker-tag ${post.type}`} style={{ marginLeft: '1.25rem' }}>
            {post.type === 'problem' ? 'Problem' : 'Idea'}
          </span>

          {isOwner && (
            <button
              onClick={() => router.push(`/analytics?postId=${post.id}`)}
              className="theme-toggle-btn"
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-hover)',
                color: 'var(--accent-blue)',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              title="View Analytics"
            >
              <BarChart2 size={14} />
              Analytics
            </button>
          )}
        </div>
      </div>

      {/* ── Interactive Comments Section ── */}
      {post.type === 'problem' && (
        <section id="solutions" className="solutions-section">
          <div className="solutions-section-header">
            <div>
              <h2>Solutions</h2>
            </div>
            <button
              type="button"
              className="solution-secondary-btn"
              onClick={openCreateSolutionModal}
            >
              <Send size={14} />
              Post solution
            </button>
          </div>

          {isSolutionsLoading && (
            <div className="solutions-loading">
              <Loader2 size={18} className="spin" />
              <span>Loading solutions...</span>
            </div>
          )}

          {!isSolutionsLoading && solutions.length === 0 && (
            <p className="solutions-empty-text">No solution yet. Share the first practical answer for this problem.</p>
          )}

          {solutions.length > 0 && (
            <div className="solutions-list">
              {solutions.map((solution) => (
                <SolutionCard
                  key={solution.id}
                  solution={solution}
                  isOwner={session?.user?.id === solution.user_id}
                  userVote={userSolutionVotes[solution.id] || null}
                  votingSolutionIds={votingSolutionIds}
                  session={session}
                  onVote={handleSolutionVote}
                  onAuthRequired={() => setIsAuthOpen(true)}
                  animateUpvote={animateUpvote}
                  onEdit={() => openEditSolutionModal(solution)}
                  onDelete={async () => {
                    if (!session || !window.confirm('Delete this solution?')) return;
                    const res = await fetch(`/api/solutions?id=${solution.id}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    });
                    if (res.ok) {
                      setSolutions((prev) => prev.filter((item) => item.id !== solution.id));
                      setPost((prev) => {
                        const nextCount = Math.max(0, (prev.solutions_count || 1) - 1);
                        return { ...prev, solutions_count: nextCount, solved: nextCount > 0 };
                      });
                    }
                  }}
                />
              ))}
            </div>
          )}

        </section>
      )}

      <div className="comments-section post-comments-section">
        <h2 className="post-comments-title">Comments ({comments.length})</h2>

        <CommentThread
          comments={comments}
          session={session}
          postId={post.id}
          highlightCommentId={highlightComment}
          onAuthRequired={() => setIsAuthOpen(true)}
          onAddComment={async (body, parentId) => {
            try {
              await handleAddComment(body, parentId);
            } catch (err: any) {
              alert(err.message || 'Failed to post comment');
            }
          }}
          onEditComment={async (commentId, body) => {
            await handleEditComment(commentId, body);
          }}
          onDeleteComment={async (commentId) => {
            if (!window.confirm('Delete comment?')) return;
            await handleDeleteComment(commentId);
          }}
        />
      </div>

      {/* Modals & Toast */}
      {isSolutionModalOpen && (
        <div className="solution-modal-overlay" onClick={() => setIsSolutionModalOpen(false)} role="presentation">
          <div className="solution-modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="solution-modal-title">
            <div className="solution-modal-header">
              <div>
                <p className="solutions-eyebrow">Developer solution</p>
                <h2 id="solution-modal-title">{editingSolutionId ? 'Edit Solution' : 'Publish Solution'}</h2>
              </div>
              <button type="button" className="solution-modal-close" onClick={() => setIsSolutionModalOpen(false)} aria-label="Close solution modal">
                x
              </button>
            </div>

            <div className="solution-modal-problem">
              <span>Solving</span>
              <strong>{decodeHTMLEntities(post.title)}</strong>
            </div>

            <div className="solution-composer solution-composer--modal">
              <input
                value={solutionTitle}
                onChange={(e) => setSolutionTitle(e.target.value)}
                placeholder="Solution title"
                className="solution-input"
                maxLength={220}
              />
              <textarea
                value={solutionBody}
                onChange={(e) => setSolutionBody(e.target.value)}
                placeholder="Explain the solution, implementation approach, or product idea..."
                className="solution-textarea"
                rows={6}
              />
              <input
                value={solutionLink}
                onChange={(e) => setSolutionLink(e.target.value)}
                placeholder="Optional solution link"
                className="solution-input"
              />
              <ImageUploader imageUrls={solutionImageUrls} onChange={setSolutionImageUrls} maxFiles={6} />
            </div>

            <div className="solution-modal-actions">
              <button type="button" className="solution-modal-cancel" onClick={() => setIsSolutionModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="solution-submit-btn"
                disabled={isSubmittingSolution}
                onClick={handleSubmitSolution}
              >
                {isSubmittingSolution ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                {editingSolutionId ? 'Save Changes' : 'Publish Solution'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      
      {isEditPostOpen && (
        <EditPostModal
          isOpen={isEditPostOpen}
          onClose={() => setIsEditPostOpen(false)}
          post={post}
          session={session}
        />
      )}

      <DeleteConfirmModal
        isOpen={isDeletePostOpen}
        onClose={() => setIsDeletePostOpen(false)}
        onConfirm={handleDeletePost}
        isPending={isDeletingPost}
      />

      {toastMessage && (
        <div className="share-toast">
          {toastMessage}
        </div>
      )}
    </article>
  );
}

interface SolutionComment {
  id: string;
  user_id: string;
  solution_id: string;
  body: string;
  created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null; role: string | null; username: string | null } | null;
}

function SolutionCard({
  solution,
  isOwner,
  userVote,
  votingSolutionIds,
  session,
  onVote,
  onAuthRequired,
  animateUpvote,
  onEdit,
  onDelete,
}: {
  solution: Solution;
  isOwner: boolean;
  userVote: 'up' | 'down' | null;
  votingSolutionIds: Record<string, boolean>;
  session: any;
  onVote: (solutionId: string, voteType: 'up' | 'down') => void;
  onAuthRequired: () => void;
  animateUpvote: (target: HTMLElement) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const authorName = solution.profiles?.full_name || 'Developer';
  const authorAvatar = solution.profiles?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${solution.user_id}`;
  const hasUpvoted = userVote === 'up';
  const hasDownvoted = userVote === 'down';

  // Solution comments state
  const [showComments, setShowComments] = useState(false);
  const [solutionComments, setSolutionComments] = useState<SolutionComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [localCommentsCount, setLocalCommentsCount] = useState(solution.comments_count);

  const fetchComments = async () => {
    setIsLoadingComments(true);
    try {
      const { data } = await supabase
        .from('solution_comments')
        .select('*, profiles:user_id(full_name, avatar_url, role, username)')
        .eq('solution_id', solution.id)
        .order('created_at', { ascending: true });
      setSolutionComments(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleToggleComments = () => {
    const next = !showComments;
    setShowComments(next);
    if (next && solutionComments.length === 0) fetchComments();
  };

  const handleAddComment = async () => {
    if (!session) { onAuthRequired(); return; }
    if (!commentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      const { data, error } = await supabase
        .from('solution_comments')
        .insert({ user_id: session.user.id, solution_id: solution.id, body: commentText.trim() })
        .select('*, profiles:user_id(full_name, avatar_url, role, username)')
        .single();
      if (error) throw error;
      if (data) {
        setSolutionComments((prev) => [...prev, data]);
        setLocalCommentsCount((c) => c + 1);
        setCommentText('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await supabase.from('solution_comments').delete().eq('id', commentId);
      setSolutionComments((prev) => prev.filter((c) => c.id !== commentId));
      setLocalCommentsCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <article className="solution-card" data-solution-id={solution.id}>
      <div className="solution-card-header">
        <Avatar src={solution.profiles?.avatar_url} name={authorName} className="solution-avatar" size={40} />
        <div>
          <h3>{decodeHTMLEntities(solution.title)}</h3>
          <p>
            Solved by {authorName}
            {solution.profiles?.role ? ` · ${solution.profiles.role}` : ''} · {new Date(solution.created_at).toLocaleDateString()}
          </p>
        </div>
        {isOwner && (
          <div className="solution-owner-actions">
            <button type="button" className="solution-owner-btn" onClick={onEdit} aria-label="Edit solution">
              <Pencil size={14} />
            </button>
            <button type="button" className="solution-owner-btn solution-owner-btn--danger" onClick={onDelete} aria-label="Delete solution">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <p className="solution-card-body">{decodeHTMLEntities(solution.body)}</p>
      <ImageGallery imageUrlsString={solution.image_url} />

      {solution.external_link && (
        <a className="solution-link" href={solution.external_link} target="_blank" rel="noreferrer">
          <ExternalLink size={13} />
          {solution.link_name || solution.external_link}
        </a>
      )}

      <div className="solution-card-footer">
        {/* Upvote */}
        <button
          type="button"
          className={`vote-container ${votingSolutionIds[solution.id] ? 'loading' : ''} ${hasUpvoted ? 'active' : ''}`}
          disabled={votingSolutionIds[solution.id]}
          onClick={(e) => {
            animateUpvote(e.currentTarget);
            onVote(solution.id, 'up');
          }}
          aria-label="Upvote solution"
          style={{ borderColor: hasUpvoted ? '#22c55e' : undefined, background: hasUpvoted ? 'rgba(34, 197, 94, 0.08)' : undefined }}
        >
          <TriangleIcon size={15} fill={hasUpvoted ? 'currentColor' : 'none'} />
          <span className={`vote-label up ${hasUpvoted ? 'active' : ''}`} style={{ color: hasUpvoted ? '#22c55e' : undefined }}>+{solution.upvotes}</span>
        </button>

        {/* Downvote */}
        <button
          type="button"
          className={`vote-container ${votingSolutionIds[solution.id] ? 'loading' : ''} ${hasDownvoted ? 'active' : ''}`}
          disabled={votingSolutionIds[solution.id]}
          onClick={() => onVote(solution.id, 'down')}
          aria-label="Downvote solution"
          style={{ borderColor: hasDownvoted ? '#ef4444' : undefined, background: hasDownvoted ? 'rgba(239, 68, 68, 0.08)' : undefined }}
        >
          <TriangleIcon size={15} style={{ transform: 'rotate(180deg)' }} fill={hasDownvoted ? 'currentColor' : 'none'} />
          <span className={`vote-label down ${hasDownvoted ? 'active' : ''}`}>-{solution.downvotes}</span>
        </button>

        {/* Comments pill */}
        <button
          type="button"
          className="solution-comments-pill"
          onClick={handleToggleComments}
          style={{ cursor: 'pointer', border: 'none' }}
        >
          <MessageCircle size={14} />
          {localCommentsCount}
        </button>
      </div>

      {/* Collapsible comments section */}
      {showComments && (
        <div className="solution-comments-section" style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
          {isLoadingComments ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem 0' }}>
              <Loader2 size={14} className="spin" /> Loading comments...
            </div>
          ) : (
            <>
              {solutionComments.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.25rem 0 0.75rem' }}>No comments yet.</p>
              )}
              {solutionComments.map((comment) => (
                <div key={comment.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <Avatar
                    src={comment.profiles?.avatar_url}
                    name={comment.profiles?.full_name || 'User'}
                    size={28}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-main)' }}>
                        {comment.profiles?.full_name || 'User'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>·</span>
                      <time style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(comment.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </time>
                      {session?.user?.id === comment.user_id && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', fontSize: '0.7rem' }}
                          aria-label="Delete comment"
                         >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {comment.body}
                    </p>
                  </div>
                </div>
              ))}

              {/* Comment composer */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <Avatar
                  src={session?.user?.user_metadata?.avatar_url}
                  name="You"
                  size={28}
                />
                <div style={{ flex: 1, display: 'flex', gap: '0.35rem' }}>
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                    placeholder={session ? 'Write a comment...' : 'Sign in to comment'}
                    disabled={isSubmittingComment}
                    onClick={() => { if (!session) onAuthRequired(); }}
                    style={{
                      flex: 1,
                      background: 'var(--search-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-main)',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddComment}
                    disabled={isSubmittingComment || !commentText.trim()}
                    style={{
                      background: commentText.trim() ? '#22c55e' : 'var(--search-bg)',
                      color: commentText.trim() ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '50%',
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: commentText.trim() ? 'pointer' : 'default',
                      flexShrink: 0,
                    }}
                  >
                    {isSubmittingComment ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}
