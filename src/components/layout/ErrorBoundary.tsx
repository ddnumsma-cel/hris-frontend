import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { AlertTriangleIcon } from "@/components/icons";

interface Props {
  children: ReactNode;
  /** A page-level boundary: shown inside the page area (the sidebar stays) and cleared when this changes (e.g. the path). */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  key?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, key: this.props.resetKey };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  // Moving to another page clears the error, so one broken page never locks the rest.
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { hasError: false, key: props.resetKey } : null;
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className={this.props.resetKey === undefined ? "flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-ink" : "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center text-ink"}>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-critical-tint text-critical">
          <AlertTriangleIcon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-lg font-semibold">Something went wrong</h1>
          <p className="mt-1 max-w-sm text-sm text-ink-2">
            This page hit an unexpected error. Reloading usually fixes it — your data is safe.
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    );
  }
}
