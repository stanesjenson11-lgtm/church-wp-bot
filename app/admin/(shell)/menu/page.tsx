"use client";

import { ArrowDown, ArrowUp, ChevronRight, LayoutTemplate, ListOrdered } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { TYPE_META, toInput } from "@/components/block-meta";
import { EmptyState } from "@/components/empty-state";
import { PageHead, Toggle } from "@/components/fields";
import { move } from "@/components/question-editor";
import { ListSkeleton } from "@/components/skeletons";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { MenuPreview } from "@/components/whatsapp-preview";
import { api } from "@/lib/api";
import { LIMITS, type Block } from "@/lib/shared/blocks";
import { attempt, useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";

/**
 * The bot's menu, in order, beside a phone that plays it back. The number on
 * each shown item is the shortcut a member can type instead of tapping.
 */
export default function MenuPage() {
  const { data, set } = useLoad(() => Promise.all([api.blocks(), api.settings(), api.events()]));
  if (!data) return <ListSkeleton />;
  const [blocks, settings, events] = data;
  const shown = blocks.filter((b) => b.enabled).length;

  async function reorder(next: Block[]) {
    const before = blocks;
    set([next, settings, events]);
    const ok = await attempt(() => api.orderBlocks(next.map((b) => b.id)));
    if (!ok) set([before, settings, events]);
  }

  async function toggle(block: Block, enabled: boolean) {
    if (enabled && shown >= LIMITS.listRows) {
      return void toast.error(`WhatsApp menus hold ${LIMITS.listRows} items. Hide one first, or put this inside a List item.`);
    }
    const saved = await attempt(() => api.updateBlock(block.id, { ...toInput(block), enabled }), enabled ? "Shown in the menu" : "Hidden from the menu");
    if (saved) set([blocks.map((b) => (b.id === saved.id ? saved : b)), settings, events]);
  }

  // Shown items get their shortcut number in menu order; hidden ones none.
  let n = 0;
  const numbered = blocks.map((b) => ({ block: b, number: b.enabled ? ++n : null }));

  return (
    <div className="space-y-6">
      <PageHead title="Bot menu" description="What members see when they message the church, in this order.">
        <Link href="/admin/templates" className={cn(buttonVariants({ variant: "secondary" }), "h-11 gap-2 px-4")}>
          <LayoutTemplate className="size-[18px]" strokeWidth={1.75} />
          Add from templates
        </Link>
      </PageHead>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <SlotMeter used={shown} />
          {blocks.length === 0 ? (
            <div className="tile">
              <EmptyState
                icon={ListOrdered}
                title="The menu is empty"
                hint="Pick ready-made items such as Service Timings, Prayer Request or Events, then edit the words."
                action={{ href: "/admin/templates", label: "Browse templates" }}
              />
            </div>
          ) : (
            <ol className="tile divide-y divide-border overflow-hidden">
              {numbered.map(({ block, number }, i) => {
                const meta = TYPE_META[block.type];
                return (
                  <li key={block.id} className={cn("flex items-center gap-3 px-3 py-3 sm:px-4", !block.enabled && "bg-muted/40")}>
                    <span
                      aria-label={number ? `Shortcut ${number}` : "Hidden"}
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums",
                        number ? "bg-primary text-primary-foreground" : "bg-foreground/[0.06] text-muted-foreground",
                      )}
                    >
                      {number ?? "–"}
                    </span>
                    <Link href={`/admin/menu/edit?id=${encodeURIComponent(block.id)}`} className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm font-medium", !block.enabled && "text-muted-foreground")}>{block.title}</span>
                        <span className="flex items-center gap-1.5 truncate text-[13px] text-muted-foreground">
                          <meta.icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
                          {meta.label}
                          {block.description && <span className="truncate">· {block.description}</span>}
                        </span>
                      </span>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-[translate] duration-150 ease-out group-hover:translate-x-0.5" />
                    </Link>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button variant="ghost" size="icon-sm" aria-label={`Move ${block.title} up`} disabled={i === 0} onClick={() => void reorder(move(blocks, i, -1))}>
                        <ArrowUp />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Move ${block.title} down`} disabled={i === blocks.length - 1} onClick={() => void reorder(move(blocks, i, 1))}>
                        <ArrowDown />
                      </Button>
                    </div>
                    <Toggle hideLabel label={`Show ${block.title} in the menu`} checked={block.enabled} onChange={(on) => void toggle(block, on)} />
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <aside aria-label="Preview" className="space-y-3 lg:sticky lg:top-[100px]">
          <MenuPreview blocks={blocks} settings={settings} events={events} />
          <p className="text-center text-xs text-muted-foreground">Tap the menu in the phone to try it. Nothing is sent.</p>
        </aside>
      </div>
    </div>
  );
}

/** Ten segments, one per menu spot WhatsApp allows. */
function SlotMeter({ used }: { used: number }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <div aria-hidden className="flex flex-1 gap-1">
        {Array.from({ length: LIMITS.listRows }, (_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-[background-color] duration-200", i < used ? "bg-primary" : "bg-foreground/10")} />
        ))}
      </div>
      <p className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
        <span className="font-medium text-foreground">{used}</span> of {LIMITS.listRows} menu spots used
      </p>
    </div>
  );
}
