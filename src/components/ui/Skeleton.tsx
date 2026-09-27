import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <span className={clsx("skeleton block rounded-md", className)} />;
}

export function SkeletonRows({ columns, rows = 3 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className="border-b border-border px-4 py-2.5">
              <Skeleton className="h-4 w-full max-w-32" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
