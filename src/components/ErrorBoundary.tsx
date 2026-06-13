'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.fallback) {
        return this.fallback;
      }
      return (
        <div 
          className="card" 
          style={{ 
            padding: '1.5rem', 
            textAlign: 'center', 
            color: 'var(--text-main)',
            border: '1px solid #ef4444',
            background: 'rgba(239, 68, 68, 0.05)',
            margin: '1rem 0'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem', color: '#ef4444' }}>
            <AlertTriangle size={36} />
          </div>
          <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Failed to display this content</h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button 
            className="btn" 
            style={{ marginTop: '0.75rem', fontSize: '0.78rem' }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }

  private get fallback() {
    return this.props.fallback;
  }
}
