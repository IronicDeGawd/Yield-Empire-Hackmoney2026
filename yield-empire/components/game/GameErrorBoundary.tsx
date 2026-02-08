'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GameErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Game page crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen flex items-center justify-center bg-game-bg text-white">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">&#x1F6E0;</div>
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-400 mb-6">
              The game encountered an error. This is usually caused by a rendering issue.
            </p>
            {this.state.error && (
              <pre className="text-xs text-red-400 bg-red-900/20 rounded-lg p-3 mb-6 overflow-auto max-h-32 text-left">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="btn-gold"
            >
              [ Try Again ]
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
