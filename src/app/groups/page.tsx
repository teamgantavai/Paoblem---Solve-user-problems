'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function GroupsRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const groupId = searchParams?.get('groupId');
    if (groupId) {
      router.replace(`/chats?groupId=${groupId}`);
    } else {
      router.replace('/chats');
    }
  }, [router, searchParams]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#070708', color: 'white' }}>
      <Loader2 className="spin" size={28} style={{ animation: 'spinAnim 0.8s linear infinite' }} />
      <style jsx global>{`
        @keyframes spinAnim {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function GroupsPage() {
  return (
    <Suspense fallback={null}>
      <GroupsRedirectContent />
    </Suspense>
  );
}
