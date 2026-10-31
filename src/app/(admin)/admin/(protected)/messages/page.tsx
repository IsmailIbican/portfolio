import Link from "next/link";
import { DeleteForm } from "@/components/admin/delete-form";
import { Button } from "@/components/ui/button";
import { countByStatus, listSubmissions } from "@/features/contact/service";
import { getTurnstileConfig } from "@/features/contact/turnstile";
import { getContactMailto } from "@/features/profile/links";
import type { ContactStatus } from "@/generated/prisma/client";
import { cn } from "@/lib/cn";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { deleteMessageAction, setMessageStatusAction } from "./actions";

export const metadata = { title: "Messages" };

const FILTERS: Array<{ key: string; label: string; status?: ContactStatus }> = [
  { key: "all", label: "All" },
  { key: "new", label: "New", status: "NEW" },
  { key: "read", label: "Read", status: "READ" },
  { key: "archived", label: "Archived", status: "ARCHIVED" },
];

const STATUS_LABEL: Record<ContactStatus, string> = { NEW: "New", READ: "Read", ARCHIVED: "Archived" };

const formatDate = (date: Date) => `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ filter?: string | string[] }> }) {
  await requireAdmin();
  const { filter } = await searchParams;
  const active = FILTERS.find((item) => item.key === filter) ?? FILTERS[0]!;

  const db = getDb();
  const [messages, counts] = await Promise.all([listSubmissions(db, active.status), countByStatus(db)]);
  const countOf = (status?: ContactStatus) =>
    counts.filter((row) => !status || row.status === status).reduce((sum, row) => sum + row._count._all, 0);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
      <p className="mt-2 text-sm text-muted">
        Messages sent through the contact form. Each one stores the name, email and text, plus an anonymous visitor code that is erased after one hour
        (it only exists to limit spam). Delete messages you no longer need.
      </p>
      {process.env.NODE_ENV === "production" && !getTurnstileConfig() ? (
        <p role="note" className="mt-3 rounded-base border border-border bg-surface p-3 text-sm">
          <span className="font-medium">Spam protection is reduced.</span> Cloudflare Turnstile is not configured, so the form relies on its hidden trap field, the
          one-time token and rate limits only. Add the Turnstile keys before sharing the site widely.
        </p>
      ) : null}

      <nav aria-label="Filter messages" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <li key={item.key}>
              <Link
                href={item.key === "all" ? "/admin/messages" : `/admin/messages?filter=${item.key}`}
                aria-current={item.key === active.key ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-base border px-3 text-sm transition-colors duration-(--duration-hover)",
                  item.key === active.key ? "border-text font-medium text-text" : "border-border text-muted hover:border-border-strong hover:text-text",
                )}
              >
                {item.label} ({countOf(item.status)})
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {messages.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No messages here.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {messages.map((message) => (
            <li key={message.id}>
              <details className="rounded-base border border-border p-4">
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={cn("min-w-0 break-words text-sm", message.status === "NEW" ? "font-semibold" : "font-medium")}>{message.name}</span>
                  <time dateTime={message.createdAt.toISOString()} className="text-xs text-muted">
                    {formatDate(message.createdAt)}
                  </time>
                  <span className="rounded-base border border-border px-2 py-0.5 text-xs text-muted">{STATUS_LABEL[message.status]}</span>
                </summary>
                <div className="mt-4 space-y-4">
                  <p className="break-all text-sm">
                    <a href={getContactMailto({ contactEmail: message.email }) ?? undefined} className="underline underline-offset-4">
                      {message.email}
                    </a>
                  </p>
                  {/* Plain text only: visitors control this content. */}
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    {message.status !== "READ" ? <StatusButton id={message.id} status="READ" label="Mark as read" /> : null}
                    {message.status !== "NEW" ? <StatusButton id={message.id} status="NEW" label="Mark as new" /> : null}
                    {message.status !== "ARCHIVED" ? <StatusButton id={message.id} status="ARCHIVED" label="Archive" /> : null}
                    <DeleteForm
                      action={deleteMessageAction}
                      id={message.id}
                      label={`Delete message from ${message.name}`}
                      confirmMessage={`Delete the message from ${message.name}? This cannot be undone.`}
                    />
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusButton({ id, status, label }: { id: string; status: ContactStatus; label: string }) {
  return (
    <form action={setMessageStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant="secondary">
        {label}
      </Button>
    </form>
  );
}
