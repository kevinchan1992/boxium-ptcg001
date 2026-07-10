import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  autoReloading: boolean;
}

/**
 * Detects whether the error is a stale-deployment chunk-load failure.
 * Vite code-split chunks have new hashes after every deploy; if the browser
 * has a cached HTML referencing old chunk URLs that no longer exist on the
 * server, dynamic imports throw "Failed to fetch dynamically imported module".
 */
function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module") ||
    (error.name === "TypeError" && msg.includes("import"))
  );
}

const RELOAD_FLAG = "__chunkReloadAttempted__";

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, autoReloading: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // If it's a chunk-load error AND we haven't already tried reloading,
    // mark autoReloading so the render() can trigger a hard reload.
    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
      return { hasError: true, error, autoReloading: true };
    }
    return { hasError: true, error, autoReloading: false };
  }

  componentDidUpdate() {
    if (this.state.autoReloading) {
      // Mark that we've already attempted one auto-reload to avoid loops
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      // While auto-reloading, show a minimal loading screen instead of the error
      if (this.state.autoReloading) {
        return (
          <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <RotateCcw size={32} className="animate-spin" />
              <p className="text-sm">正在更新到最新版本…</p>
            </div>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">An unexpected error occurred.</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.message}
              </pre>
            </div>

            <button
              onClick={() => {
                sessionStorage.removeItem(RELOAD_FLAG);
                window.location.reload();
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
