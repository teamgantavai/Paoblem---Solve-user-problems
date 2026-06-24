import React from 'react';
import { Post } from '@/lib/types';
import { FileText, Table2 } from 'lucide-react';

export default function RichPostContent({ post }: { post: Post }) {
  const { video_url, metadata } = post;
  
  if (!video_url && !metadata) return null;

  return (
    <div className="rich-post-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
      
      {/* VIDEO */}
      {video_url && (
        <div className="media-container" style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', background: '#000' }}>
          <video 
            src={video_url} 
            controls 
            style={{ width: '100%', maxHeight: '400px', display: 'block' }}
          />
        </div>
      )}

      {/* DOCUMENT */}
      {metadata?.documentUrl && (
        <a 
          href={metadata.documentUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ 
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', 
            background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', 
            borderRadius: '12px', textDecoration: 'none', color: 'var(--text-main)',
            transition: 'background 0.2s'
          }}
        >
          <div style={{ background: 'var(--bg-hover)', padding: '10px', borderRadius: '8px' }}>
            <FileText size={24} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Attached Document</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click to view</div>
          </div>
        </a>
      )}

      {/* TABLE */}
      {metadata?.table && Array.isArray(metadata.table) && (
        <div style={{ 
          border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden'
        }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--text-main)' }}>
            <Table2 size={18} style={{ color: 'var(--accent-blue)' }}/> 
            Data Table
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <tbody>
                {metadata.table.map((row: string[], rIdx: number) => (
                  <tr key={rIdx} style={{ borderBottom: rIdx === metadata.table.length - 1 ? 'none' : '1px solid var(--border-color)', background: rIdx === 0 ? 'var(--bg-hover)' : 'var(--bg-body)' }}>
                    {row.map((cell: string, cIdx: number) => (
                      <td key={cIdx} style={{ padding: '10px 16px', borderRight: cIdx === row.length - 1 ? 'none' : '1px solid var(--border-color)', fontWeight: rIdx === 0 ? 600 : 400, color: 'var(--text-main)' }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
