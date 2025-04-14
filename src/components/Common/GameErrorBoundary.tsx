// src/components/Common/GameErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GameErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by game boundary:', error, errorInfo);
    this.setState({
      errorInfo
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Try to detect common error patterns
      let errorMessage = "An unexpected error occurred";
      let actionMessage = "Please refresh and try again";
      
      if (this.state.error) {
        const errorText = this.state.error.toString();
        
        if (errorText.includes("Cannot read properties of undefined")) {
          errorMessage = "A component tried to access a property that doesn't exist";
          actionMessage = "This usually happens when data hasn't loaded correctly";
        } else if (errorText.includes("is not a function")) {
          errorMessage = "A function was called but isn't available";
          actionMessage = "This might be due to a timing issue with event handlers";
        } else if (errorText.includes("Maximum update depth exceeded")) {
          errorMessage = "The application got stuck in an update loop";
          actionMessage = "This is usually caused by an issue in a useEffect hook";
        }
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="text-center p-6 max-w-md">
            <div className="text-red-600 mb-4">
              <svg
                className="h-12 w-12 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Something went wrong
            </h3>
            <p className="text-gray-600 mb-2">
              {errorMessage}
            </p>
            <p className="text-gray-500 mb-4 text-sm">
              {actionMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent 
                rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 
                hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
                focus:ring-blue-500"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
