"use client";

import { Check, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PRESET_ICONS, TYPE_META } from "@/components/block-meta";
import { PageHead } from "@/components/fields";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { WaText, blockMessage } from "@/components/whatsapp-preview";
import { api } from "@/lib/api";
import { LIMITS, type Block } from "@/lib/shared/blocks";
import { PRESETS, type Preset } from "@/lib/shared/presets";
import { attempt, useLoad } from "@/lib/use-load";

const CATEGORIES: { key: Preset["category"]; title: string; description: string }[] = [
  { key: "Essentials", title: "Essentials", description: "What most members ask for. A new bot starts with these six." },
  { key: "Forms", title: "Forms", description: "Questions asked one at a time. The answers arrive in the Inbox." },
  { key: "Community", title: "Church life", description: "Ministries, sermons, verses and news." },
  { key: "Custom", title: "Start from blank", description: "Your own message, form or list." },
];

/**
 * Ready-made menu items. Each card shows the opening of the real reply, so a
 * volunteer picks by what members will read, not by a name. Adding one opens
 * it in the editor to change the [EDIT ME] parts.
 */
export default function TemplatesPage() {
  const router = useRouter();
  const { data } = useLoad(() => Promise.all([api.blocks(), api.settings()]));
  const [adding, setAdding] = useState<string | null>(null);
  if (!data) return <ListSkeleton />;
  const [blocks, settings] = data;
  const shown = blocks.filter((b) => b.enabled).length;
  const titles = new Set(blocks.map((b) => b.title.toLowerCase()));

  async function add(preset: Preset) {
    setAdding(preset.key);
    // A full menu still takes the item, hidden, ready to swap in.
    const full = shown >= LIMITS.listRows;
    const block = await attempt(
      () => api.createBlock({ ...preset.block, enabled: preset.block.enabled && !full }),
      full ? "Added as hidden: the menu already has 10 items" : "Added to the menu",
    );
    setAdding(null);
    if (block) router.push(`/admin/menu/edit?id=${encodeURIComponent(block.id)}`);
  }

  return (
    <div className="space-y-8">
      <PageHead title="Templates" description="Ready-made menu items for a church. Add one, then change the words to fit yours.">
        <Link href="/admin/menu" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
          Back to the menu
        </Link>
      </PageHead>

      {CATEGORIES.map((cat) => (
        <section key={cat.key} aria-labelledby={`cat-${cat.key}`} className="space-y-3">
          <div>
            <h3 id={`cat-${cat.key}`} className="text-base font-semibold tracking-[-0.01em]">
              {cat.title}
            </h3>
            <p className="text-[13px] text-muted-foreground">{cat.description}</p>
          </div>
          <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
            {PRESETS.filter((p) => p.category === cat.key).map((p) => {
              const Icon = PRESET_ICONS[p.icon] ?? TYPE_META[p.block.type].icon;
              const inMenu = titles.has(p.block.title.toLowerCase()) && cat.key !== "Custom";
              const reply = blockMessage({ ...p.block, id: p.key, position: 0, updatedAt: "" } as Block, settings, []);
              return (
                <li key={p.key} className="tile flex flex-col gap-3 p-4 [--secondary:var(--muted)]">
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary">
                      <Icon className="size-[18px]" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-[13px] text-muted-foreground">{p.blurb}</p>
                    </div>
                  </div>

                  {/* The opening of the actual reply, in WhatsApp's own bubble. */}
                  <div
                    aria-label={`Sample reply: ${reply.body.slice(0, 120)}`}
                    className="flex-1 rounded-[16px] bg-[#efeae2] p-2.5 text-[#111b21] dark:bg-[#0b141a] dark:text-[#e9edef]"
                  >
                    <p aria-hidden className="rounded-[10px] rounded-tl-[3px] bg-white px-2.5 py-1.5 text-[13px] leading-snug shadow-[0_1px_0.5px_rgb(0_0_0/0.13)] dark:bg-[#202c33]">
                      <span className="line-clamp-4 whitespace-pre-line">
                        {reply.location ? `📍 ${reply.location.name}\n${reply.location.address}` : <WaText text={reply.body} />}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{TYPE_META[p.block.type].label}</span>
                    {inMenu ? (
                      <span className="flex h-8 items-center gap-1 px-1 text-[13px] font-medium text-ink">
                        <Check className="size-4" strokeWidth={2} />
                        In your menu
                      </span>
                    ) : (
                      <Button size="sm" variant="secondary" className="gap-1" disabled={adding !== null} onClick={() => void add(p)}>
                        <Plus />
                        {adding === p.key ? "Adding…" : "Add"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
