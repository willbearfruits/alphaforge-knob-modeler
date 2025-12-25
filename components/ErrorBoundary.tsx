import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  theme?: 'dark' | 'light';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error Boundary caught an error:', error, errorInfo);

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const theme = this.props.theme || 'dark';

      return (
        <div className={`min-h-screen flex items-center justify-center p-4 ${
          theme === 'dark' ? 'bg-gray-950' : 'bg-gray-50'
        }`}>
          <div className={`max-w-md w-full p-6 rounded-lg border shadow-lg ${
            theme === 'dark'
              ? 'bg-gray-900 border-gray-800'
              : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className={`w-8 h-8 ${
                theme === 'dark' ? 'text-red-400' : 'text-red-600'
              }`} />
              <h1 className={`text-xl font-bold ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
              }`}>
                Something went wrong
              </h1>
            </div>

            <p className={`mb-4 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              An unexpected error occurred. You can try reloading the application or contact support if the problem persists.
            </p>

            {this.state.error && (
              <details className={`mb-4 p-3 rounded border ${
                theme === 'dark'
                  ? 'bg-gray-800/50 border-gray-700'
                  : 'bg-gray-100 border-gray-300'
              }`}>
                <summary className={`cursor-pointer font-semibold ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Error Details
                </summary>
                <pre className={`mt-2 text-xs overflow-x-auto ${
                  theme === 'dark' ? 'text-red-400' : 'text-red-600'
                }`}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className={`flex-1 px-4 py-2 rounded font-semibold transition-colors ${
                  theme === 'dark'
                    ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                    : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                }`}
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className={`flex-1 px-4 py-2 rounded font-semibold border transition-colors ${
                  theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-200'
                    : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-700'
                }`}
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
