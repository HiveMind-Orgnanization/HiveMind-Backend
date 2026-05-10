import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Snake app error boundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-lg mx-auto mt-16 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/70 dark:bg-red-950/40 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
            Something went wrong.
          </h2>
          <p className="text-sm text-red-600 dark:text-red-200 mb-4">
            An unexpected error occurred while rendering the game UI.
          </p>
          <button
            className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
