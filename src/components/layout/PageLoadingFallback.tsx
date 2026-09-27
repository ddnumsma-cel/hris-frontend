import { LoaderIcon } from "@/components/icons";

export function PageLoadingFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoaderIcon className="h-6 w-6 animate-spin text-brand-ink" />
    </div>
  );
}
