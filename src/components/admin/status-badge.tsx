export function StatusBadge({ status }: { status: "DRAFT" | "PUBLISHED" }) {
  return (
    <span className="rounded-base border border-border px-2 py-0.5 text-xs text-muted">
      {status === "PUBLISHED" ? "Published" : "Draft"}
    </span>
  );
}
