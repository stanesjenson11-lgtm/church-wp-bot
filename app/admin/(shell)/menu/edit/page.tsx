"use client";

import { ChevronLeft, Trash } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { BlockEditor } from "@/components/block-editor";
import { TYPE_META, toInput } from "@/components/block-meta";
import { Confirm } from "@/components/confirm";
import { EmptyState } from "@/components/empty-state";
import { StackSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { BlockPreview, MenuPreview } from "@/components/whatsapp-preview";
import { api } from "@/lib/api";
import { BlockInputSchema, type Block, type BlockInput, type ChurchEvent } from "@/lib/shared/blocks";
import type { Settings } from "@/lib/shared/settings";
import { attempt, useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";

export default function EditBlockPage() {
  return (
    <Suspense fallback={<StackSkeleton />}>
      <Loader />
    </Suspense>
  );
}

function Loader() {
  const id = useSearchParams().get("id") ?? "";
  const { data } = useLoad(() => Promise.all([api.blocks(), api.settings(), api.events()]));
  if (!data) return <StackSkeleton />;
  const [blocks, settings, events] = data;
  const block = blocks.find((b) => b.id === id);
  if (!block) {
    return (
      <div className="tile">
        <EmptyState icon={TYPE_META.text.icon} title="This item no longer exists" hint="It may have been deleted." action={{ href: "/admin/menu", label: "Back to the menu" }} />
      </div>
    );
  }
  return <Editor key={block.id} block={block} blocks={blocks} settings={settings} events={events} />;
}

/** Empty option lines and rows are typing in progress, not content: drop them before saving. */
function tidy(input: BlockInput): BlockInput {
  if (input.type === "form") {
    return {
      ...input,
      data: { ...input.data, questions: input.data.questions.map((q) => (q.options ? { ...q, options: q.options.map((o) => o.trim()).filter(Boolean) } : q)) },
    };
  }
  if (input.type === "verse") return { ...input, data: { verses: input.data.verses.map((v) => v.trim()).filter(Boolean) } };
  return input;
}

/** "data.questions.0.label" → "Question 1 › what the bot asks". */
function where(path: PropertyKey[]): string {
  const names: Record<string, string> = {
    title: "Name",
    description: "Line under the name",
    body: "Text",
    intro: "First message",
    thanks: "Thank-you message",
    label: "Question",
    options: "Options",
    items: "Row",
    button: "Button text",
    url: "Link",
    verses: "Verses",
    empty: "Nothing coming up",
    name: "Place name",
    address: "Address",
  };
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const p = String(path[i]);
    if (p === "data") continue;
    if (p === "questions" && typeof path[i + 1] === "number") parts.push(`Question ${(path[++i] as number) + 1}`);
    else if (p === "items" && typeof path[i + 1] === "number") parts.push(`Row ${(path[++i] as number) + 1}`);
    else if (typeof path[i] !== "number") parts.push(names[p] ?? p);
  }
  return parts.join(" › ");
}

function Editor({ block, blocks, settings, events }: { block: Block; blocks: Block[]; settings: Settings; events: ChurchEvent[] }) {
  const router = useRouter();
  const [saved, setSaved] = useState<BlockInput>(() => toInput(block));
  const [draft, setDraft] = useState<BlockInput>(saved);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [view, setView] = useState<"item" | "menu">("item");
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const meta = TYPE_META[draft.type];

  // Closing the tab with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    const parsed = BlockInputSchema.safeParse(tidy(draft));
    if (!parsed.success) {
      const list = parsed.error.issues.map((i) => `${where(i.path)}: ${i.message}`);
      setIssues(list);
      return void toast.error(list[0] ?? "Some fields need attention");
    }
    setIssues([]);
    setBusy(true);
    const result = await attempt(() => api.updateBlock(block.id, parsed.data), "Saved. The bot uses it from the next message.");
    setBusy(false);
    if (result) {
      const next = toInput(result);
      setSaved(next);
      setDraft(next);
    }
  }

  const live: Block = { ...block, ...draft } as Block;
  const menu = blocks.map((b) => (b.id === block.id ? live : b));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/menu" className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary transition-[background-color,scale] duration-150 ease-out hover:bg-foreground/[0.08] active:scale-[0.95]" aria-label="Back to the menu">
          <ChevronLeft className="size-5" strokeWidth={1.75} />
        </Link>
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="truncate text-xl font-semibold tracking-tight">{draft.title || "Untitled"}</h2>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <meta.icon aria-hidden className="size-4" strokeWidth={1.75} />
            {meta.sends}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Confirm
            trigger={
              <Button variant="ghost" className="h-11 gap-2 px-4">
                <Trash />
                Delete
              </Button>
            }
            title={`Delete “${block.title}”?`}
            description="It disappears from the bot's menu straight away. Answers already in the Inbox stay."
            action="Delete item"
            onConfirm={async () => {
              const ok = await attempt(() => api.deleteBlock(block.id), "Deleted");
              if (ok) router.push("/admin/menu");
            }}
          />
          <Button onClick={() => void save()} disabled={busy || !dirty} className="h-11 px-5">
            {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </div>

      {issues.length > 0 && (
        <div role="alert" className="rounded-[22px] bg-destructive/10 px-5 py-4 text-sm text-destructive squircle">
          <p className="font-medium">Fix these before saving:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {issues.slice(0, 6).map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <BlockEditor value={draft} onChange={setDraft} />

        <aside aria-label="Preview" className="space-y-3 lg:sticky lg:top-[100px]">
          <nav aria-label="Preview" className="mx-auto flex w-fit rounded-full bg-foreground/[0.06] p-1 text-[13px] font-medium">
            {(
              [
                ["item", "This item"],
                ["menu", "Whole menu"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96]",
                  view === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </nav>
          {view === "item" ? (
            <BlockPreview block={live} settings={settings} events={events} />
          ) : (
            <MenuPreview blocks={menu} settings={settings} events={events} />
          )}
          <p className="text-center text-xs text-muted-foreground">{dirty ? "Showing your unsaved changes." : "This is what members see now."}</p>
        </aside>
      </div>
    </div>
  );
}
