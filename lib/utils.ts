export const MATCH_THRESHOLD = 70;

export function timeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  } catch {
    return "";
  }
}

export function parseMarkdown(text: string): string {
  const lines = text.split("\n");
  const hasListItems = lines.some((l) => /^[-*]\s/.test(l.trim()));

  if (hasListItems) {
    const items = lines
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => {
        const content = l.replace(/^[-*]\s+/, "");
        return `<li class="flex items-start gap-2"><span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted"></span><span>${inlineMarkdown(content)}</span></li>`;
      });
    return `<ul class="space-y-1.5">${items.join("")}</ul>`;
  }

  return `<p>${inlineMarkdown(lines.join(" "))}</p>`;
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-text-primary">$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-surface-tertiary px-1.5 py-0.5 text-xs font-medium text-text-dark">$1</code>');
}
