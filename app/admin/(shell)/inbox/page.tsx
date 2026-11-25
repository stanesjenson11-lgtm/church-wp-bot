"use client";

import { ChevronDown, Inbox, Lock, MessageCircle, Trash } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Confirm } from "@/components/confirm";
import { EmptyState } from "@/components/empty-state";
import { PageHead } from "@/components/fields";
import { useViewer } from "@/components/shell/app-shell";
import { ListSkeleton } from "@/components/skeletons";
import { Button, buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatDateTime, prettyPhone, whatsappLink } from "@/lib/format";
import type { Submission } from "@/lib/shared/api";
import { attempt, useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";

const STATUS: { value: Submission["status"]; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "Following up" },
  { value: "done", label: "Done" },
];

export default function InboxPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <InboxView />
    </Suspense>
  );
}

/**
 * Every form answer the bot has collected: prayer requests, membership,
 * visits. Each has a status, so a team can see what still needs a call.
 */
function InboxView() {
  const viewer = useViewer();
  const router = useRouter();
  const params = useSearchParams();
  const { data, set } = useLoad(() => Promise.all([api.submissions(), api.blocks()]));
  const [showDone, setShowDone] = useState(false);
  if (!data) return <ListSkeleton />;
  const [subs, blocks] = data;

  // One tab per form, including forms deleted since their answers came in.
  const forms = new Map<string, string>();
  for (const b of blocks) if (b.type === "form") forms.set(b.id, b.title);
  for (const s of subs) if (!forms.has(s.blockId)) forms.set(s.blockId, s.blockTitle);
  const current = params.get("form") ?? "";
  const inForm = subs.filter((s) => !current || s.blockId === current);
  const shown = inForm.filter((s) => showDone || s.status !== "done");
  const fresh = (id: string) => subs.filter((s) => s.status === "new" && (!id || s.blockId === id)).length;

  function replace(next: Submission) {
    set([subs.map((s) => (s.id === next.id ? next : s)), blocks]);
  }

  return (
    <div className="space-y-6">
      <PageHead
        title="Inbox"
        description={
          viewer.role === "editor"
            ? "Form answers from WhatsApp. Private forms, such as prayer requests, are for admins only."
            : "Form answers from WhatsApp, newest first."
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Forms" className="inline-flex max-w-full overflow-x-auto rounded-full bg-foreground/[0.06] p-1 [scrollbar-width:none]">
          {[["", "All"] as const, ...forms].map(([id, title]) => {
            const n = fresh(id);
            return (
              <button
                key={id || "all"}
                type="button"
                role="tab"
                aria-selected={current === id}
                onClick={() => router.replace(id ? `/admin/inbox?form=${encodeURIComponent(id)}` : "/admin/inbox", { scroll: false })}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-[color,scale] duration-150 ease-out active:scale-[0.97]",
                  current === id ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {title}
                {n > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] leading-[18px] font-semibold text-primary-foreground tabular-nums">{n}</span>}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          Show done
        </label>
      </div>

      {shown.length === 0 ? (
        <div className="tile">
          <EmptyState
            icon={Inbox}
            title={inForm.length ? "Everything here is done" : "Nothing here yet"}
            hint={inForm.length ? "Tick “Show done” to see them again." : "When a member fills in a form in WhatsApp, it arrives here."}
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((s) => (
            <Item key={s.id} sub={s} onChange={replace} onDelete={() => set([subs.filter((x) => x.id !== s.id), blocks])} canDelete={viewer.role === "admin"} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Item({ sub, onChange, onDelete, canDelete }: { sub: Submission; onChange: (s: Submission) => void; onDelete: () => void; canDelete: boolean }) {
  const [open, setOpen] = useState(sub.status === "new");
  const first = sub.answers[0]?.value ?? "";

  async function status(next: Submission["status"]) {
    const saved = await attempt(() => api.updateSubmission(sub.id, next));
    if (saved) onChange(saved);
  }

  return (
    <li className={cn("tile overflow-hidden [--secondary:var(--muted)]", sub.status === "done" && "opacity-70")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-[background-color] duration-150 ease-out hover:bg-foreground/[0.02]"
      >
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", sub.status === "new" ? "bg-primary" : "bg-transparent")} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{sub.name || prettyPhone(sub.waId)}</span>
            {sub.private && (
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Lock className="size-3" strokeWidth={2} />
                Private
              </span>
            )}
          </span>
          <span className="block truncate text-[13px] text-muted-foreground">
            {sub.blockTitle} · {formatDateTime(sub.createdAt)}
            {!open && first && ` · ${first}`}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{STATUS.find((x) => x.value === sub.status)?.label}</span>
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-[rotate] duration-200 ease-out", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-4 border-t px-4 py-4">
          <dl className="space-y-3">
            {sub.answers.map((a, i) => (
              <div key={i}>
                <dt className="text-xs text-muted-foreground">{a.label}</dt>
                <dd className="mt-0.5 text-sm whitespace-pre-line">{a.value || "—"}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Status" className="inline-flex rounded-full bg-foreground/[0.06] p-1 text-[13px] font-medium">
              {STATUS.map((x) => (
                <button
                  key={x.value}
                  type="button"
                  role="radio"
                  aria-checked={sub.status === x.value}
                  onClick={() => void status(x.value)}
                  className={cn(
                    "rounded-full px-3 py-1 transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96]",
                    sub.status === x.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <a
              href={whatsappLink(sub.waId, `Hello ${sub.name.split(/\s+/)[0] ?? ""},`.trim())}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-1.5")}
            >
              <MessageCircle />
              Reply from your phone
            </a>
            {canDelete && (
              <Confirm
                trigger={
                  <Button variant="ghost" size="sm" className="ml-auto gap-1.5">
                    <Trash />
                    Delete
                  </Button>
                }
                title="Delete this answer?"
                description="It's removed for everyone and can't be brought back."
                action="Delete answer"
                onConfirm={async () => {
                  if (await attempt(() => api.deleteSubmission(sub.id), "Deleted")) onDelete();
                }}
              />
            )}
          </div>
        </div>
      )}
    </li>
  );
}
