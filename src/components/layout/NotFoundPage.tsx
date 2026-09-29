import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { FileQuestionIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/AuthContext";

export function NotFoundPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const homeHref = user ? `/${user.role}` : "/login";

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-ink-2">
        <FileQuestionIcon className="h-6 w-6" />
      </span>
      <div>
        <h1 className="font-display text-lg font-semibold">Page not found</h1>
        <p className="mt-1 max-w-sm text-sm text-ink-2">
          The page you're looking for doesn't exist or may have moved.
        </p>
      </div>
      <Button onClick={() => navigate(homeHref, { replace: true })}>
        Back to {user ? "dashboard" : "sign in"}
      </Button>
    </div>
  );
}
