/**
 * Error Boundary Component
 *
 * React error boundary for catching and handling errors in child components.
 * Supports multiple variants (full-page, panel, inline) and optional reset capability.
 *
 * @module components/common/error-boundary
 */

import React, { Component, type ReactNode } from "react";

import { createLogger, serializeError } from "@journey/logger";

const log = createLogger("error-boundary");

// =============================================================================
// TYPES
// =============================================================================

interface ErrorBoundaryBaseProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Error boundary variant: 'full-page' (default), 'panel', or 'inline' */
  variant?: "full-page" | "panel" | "inline";
  /** Enable reset capability for panels (default: false) */
  resettable?: boolean;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Panel name for logging (used with variant='panel') */
  panelName?: string;
}

interface NonResettableProps extends ErrorBoundaryBaseProps {
  resettable?: false;
  /** Fallback UI to render on error */
  fallback?: ReactNode;
}

interface ResettableProps extends ErrorBoundaryBaseProps {
  resettable: true;
  /** Fallback UI - can be a function for resettable mode */
  fallback?: ReactNode | ((props: { resetError: () => void }) => ReactNode);
}

type ErrorBoundaryProps = NonResettableProps | ResettableProps;

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// =============================================================================
// ERROR BOUNDARY
// =============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { panelName, onError } = this.props;
    const logContext = panelName ? { panelName } : {};
    log.error({ err: serializeError(error), componentStack: errorInfo.componentStack, ...logContext }, "errorBoundary:caught");
    onError?.(error, errorInfo);
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    const { variant = "full-page", resettable, fallback } = this.props;

    if (this.state.hasError) {
      // Use custom fallback if provided
      if (fallback) {
        if (resettable && typeof fallback === "function") {
          return fallback({ resetError: this.resetError });
        }
        if (typeof fallback !== "function") {
          return fallback;
        }
      }

      // Default UI based on variant
      if (variant === "panel") {
        return this.renderPanelError();
      } else if (variant === "inline") {
        return this.renderInlineError();
      } else {
        return this.renderFullPageError();
      }
    }

    return this.props.children;
  }

  private renderFullPageError() {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-destructive/50 rounded-xl p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">{this.state.error?.message || "An unexpected error occurred"}</p>
          <button
            onClick={() => {
              this.resetError();
              window.location.reload();
            }}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  private renderPanelError() {
    const { panelName = "panel" } = this.props;
    return (
      <div className="h-full w-full bg-card/50 border border-destructive/30 rounded-lg p-4 flex flex-col items-center justify-center">
        <h3 className="text-sm font-semibold text-destructive mb-2">Error in {panelName}</h3>
        <p className="text-xs text-muted-foreground mb-3 text-center">{this.state.error?.message || "An error occurred"}</p>
        <button
          onClick={() => this.resetError()}
          className="px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  private renderInlineError() {
    return (
      <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
        <p className="text-sm text-destructive">{this.state.error?.message || "An error occurred"}</p>
      </div>
    );
  }
}
