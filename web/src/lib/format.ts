const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export const formatCompact = (n: number) => compact.format(n);
export const formatDate = (iso: string) => date.format(new Date(iso));

export function formatTask(task: string) {
  return task.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatScore(score: number, unit?: string) {
  return `${score % 1 === 0 ? score : score.toFixed(1)}${unit ?? ""}`;
}
