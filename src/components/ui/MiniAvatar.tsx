export function MiniAvatar({ initials }: { initials: string }) {
  return (
    <span className="flex h-6.5 w-6.5 flex-none items-center justify-center rounded-full bg-surface-2 text-[0.65rem] font-bold text-ink-2">
      {initials}
    </span>
  );
}
