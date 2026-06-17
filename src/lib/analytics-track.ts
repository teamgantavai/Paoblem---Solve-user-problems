import type { PostEventType, TrackEventPayload } from './types';

function getDeviceMetadata(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  const ua = navigator.userAgent;
  let device = 'desktop';
  if (/Mobi|Android/i.test(ua)) device = 'mobile';
  else if (/Tablet|iPad/i.test(ua)) device = 'tablet';

  let browser = 'Other';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Edg/i.test(ua)) browser = 'Edge';

  return {
    device,
    browser,
    referrer: document.referrer || 'direct',
    path: window.location.pathname,
  };
}

export async function trackEvent(
  postId: string,
  eventType: PostEventType,
  accessToken?: string | null,
  extraMetadata?: Record<string, unknown>
): Promise<void> {
  if (!postId || postId === 'dylan-post' || postId === 'ryan-post') return;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    await fetch('/api/analytics/track', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        post_id: postId,
        event_type: eventType,
        metadata: { ...getDeviceMetadata(), ...extraMetadata },
      } satisfies TrackEventPayload),
    });
  } catch {
    // Non-blocking — analytics should never break UX
  }
}
