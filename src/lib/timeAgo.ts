/** "Just now", "5m ago", "3h ago", "Yesterday", then the date. */
export function timeAgo(iso: string, formatDay: (d: string) => string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 60 * 48) return "Yesterday";
  return formatDay(iso.slice(0, 10));
}
