import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { AlertTriangleIcon } from "@/components/icons";

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

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-ink">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-critical-tint text-critical">
          <AlertTriangleIcon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-lg font-bold">Something went wrong</h1>
          <p className="mt-1 max-w-sm text-sm text-ink-2">
            This page hit an unexpected error. Reloading usually fixes it — your data is safe.
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    );
  }
}
