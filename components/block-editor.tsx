"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import Link from "next/link";

import { Field, Toggle } from "@/components/fields";
import { MediaField } from "@/components/media-field";
import { QuestionEditor, move } from "@/components/question-editor";
import { Button } from "@/components/ui/button";
import { LIMITS, type BlockInput } from "@/lib/shared/blocks";

/** One part of the editor: a quiet heading, then its fields. */
export function EditorSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="tile space-y-4 p-5 [--secondary:var(--muted)]">
      <div>
        <h3 className="text-base font-semibold tracking-[-0.01em]">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Edits one menu item. Each kind (message, map pin, events, form, list,
 * daily verse) has its own fields; the name, the line under it and the typed
 * shortcuts are the same for all.
 */
export function BlockEditor({ value, onChange }: { value: BlockInput; onChange: (next: BlockInput) => void }) {
  const data = (patch: Record<string, unknown>) => onChange({ ...value, data: { ...value.data, ...patch } } as BlockInput);

  return (
    <div className="space-y-4">
      <EditorSection title="In the menu" description="How this item appears in the list members open.">
        <Field label="Name" value={value.title} onChange={(title) => onChange({ ...value, title })} max={LIMITS.rowTitle} required />
        <Field
          label="Line under the name"
          value={value.description}
          onChange={(description) => onChange({ ...value, description })}
          max={LIMITS.rowDescription}
        />
        <Field
          label="Words that open it"
          value={value.keywords}
          onChange={(keywords) => onChange({ ...value, keywords })}
          placeholder="timings, service, sunday"
          hint="Separate with commas. Members can also type the item's number."
        />
        <Toggle
          checked={value.enabled}
          onChange={(enabled) => onChange({ ...value, enabled })}
          label="Show in the menu"
          hint="Hidden items keep their content, ready for later."
        />
      </EditorSection>

      <TypeFields value={value} data={data} />
    </div>
  );
}

function TypeFields({ value, data }: { value: BlockInput; data: (patch: Record<string, unknown>) => void }) {
  switch (value.type) {
    case "text": {
      const d = value.data;
      const interactive = !!d.imageId || !!d.link;
      return (
        <EditorSection title="Message" description="Use *bold*, _italic_ and ~strike~ as in WhatsApp.">
          <Field
            label="Text"
            value={d.body}
            onChange={(body) => data({ body })}
            max={interactive ? LIMITS.interactiveBody : LIMITS.textBody}
            multiline
            rows={8}
            hint={
              interactive
                ? undefined
                : `Over ${LIMITS.interactiveBody} characters it's sent as plain text, without the “Menu” button.`
            }
          />
          <MediaField
            label="Picture (optional)"
            hint="For example the church's UPI QR code. Shown above the text."
            value={d.imageId}
            onChange={(imageId) => data({ imageId })}
          />
          <Toggle
            checked={!!d.link}
            onChange={(on) => data({ link: on ? { label: "Open", url: "https://" } : null })}
            label="Add a link button"
            hint="Opens a website, such as your YouTube channel. It replaces the “Menu” button."
          />
          {d.link && (
            <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <Field label="Button text" value={d.link.label} onChange={(label) => data({ link: { ...d.link!, label } })} max={LIMITS.button} />
              <Field label="Link" type="url" value={d.link.url} onChange={(url) => data({ link: { ...d.link!, url } })} placeholder="https://" />
            </div>
          )}
        </EditorSection>
      );
    }
    case "location": {
      const d = value.data;
      return (
        <EditorSection title="Map pin" description="Members tap the pin to open directions in Google Maps.">
          <Field label="Place name" value={d.name} onChange={(name) => data({ name })} max={100} />
          <Field label="Address" value={d.address} onChange={(address) => data({ address })} max={300} multiline rows={2} />
          <Field
            label="Map coordinates"
            value={`${d.latitude}, ${d.longitude}`}
            onChange={(text) => {
              const [lat, lng] = text.split(",").map((n) => Number(n.trim()));
              if (Number.isFinite(lat) && Number.isFinite(lng)) data({ latitude: lat, longitude: lng });
            }}
            placeholder="13.0827, 80.2707"
            hint="In Google Maps, right-click the church's pin. The first line is the coordinates: click it to copy, then paste here."
          />
        </EditorSection>
      );
    }
    case "events":
      return (
        <EditorSection title="Events" description="The events themselves are added on the Events page.">
          <Field label="Above the list" value={value.data.intro} onChange={(intro) => data({ intro })} max={LIMITS.interactiveBody} multiline rows={3} />
          <Field label="When nothing is coming up" value={value.data.empty} onChange={(empty) => data({ empty })} max={LIMITS.interactiveBody} multiline rows={2} />
          <Link href="/admin/events" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
            Go to Events
          </Link>
        </EditorSection>
      );
    case "form": {
      const d = value.data;
      return (
        <>
          <EditorSection title="Form" description="The bot asks one question per message. Answers arrive in the Inbox.">
            <Field label="First message" value={d.intro} onChange={(intro) => data({ intro })} max={LIMITS.interactiveBody} multiline rows={3} />
            <Toggle
              checked={d.private}
              onChange={(on) => data({ private: on })}
              label="Private"
              hint="Only admins can read the answers. Editors never see them, which suits prayer and pastoral requests."
            />
          </EditorSection>
          <EditorSection title="Questions" description={`Up to 10. Each one is a message, so shorter forms cost less.`}>
            <QuestionEditor questions={d.questions} onChange={(questions) => data({ questions })} />
          </EditorSection>
          <EditorSection title="After the last answer">
            <Field label="Thank-you message" value={d.thanks} onChange={(thanks) => data({ thanks })} max={LIMITS.interactiveBody} multiline rows={3} />
          </EditorSection>
        </>
      );
    }
    case "submenu": {
      const d = value.data;
      const setItem = (i: number, patch: Partial<(typeof d.items)[number]>) =>
        data({ items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
      return (
        <EditorSection title="List" description="A second list inside the menu. Tapping a row sends its text.">
          <Field label="Above the list" value={d.intro} onChange={(intro) => data({ intro })} max={LIMITS.interactiveBody} multiline rows={2} />
          <Field label="List button" value={d.button} onChange={(button) => data({ button })} max={LIMITS.button} />
          <ol className="space-y-3">
            {d.items.map((it, i) => (
              <li key={it.id} className="space-y-3 rounded-[20px] bg-muted/60 p-4 squircle">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-card text-xs font-semibold tabular-nums">{i + 1}</span>
                  <span className="flex-1 truncate text-sm font-medium">{it.title || `Row ${i + 1}`}</span>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => data({ items: move(d.items, i, -1) })}>
                    <ArrowUp />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === d.items.length - 1} onClick={() => data({ items: move(d.items, i, 1) })}>
                    <ArrowDown />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove row" disabled={d.items.length <= 1} onClick={() => data({ items: d.items.filter((_, j) => j !== i) })}>
                    <X />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Row name" value={it.title} onChange={(title) => setItem(i, { title })} max={LIMITS.rowTitle} />
                  <Field label="Line under it" value={it.description} onChange={(description) => setItem(i, { description })} max={LIMITS.rowDescription} />
                </div>
                <Field label="Text it sends" value={it.body} onChange={(body) => setItem(i, { body })} max={LIMITS.interactiveBody} multiline rows={3} />
              </li>
            ))}
          </ol>
          {d.items.length < LIMITS.listRows && (
            <Button
              type="button"
              variant="secondary"
              className="gap-1.5"
              onClick={() => data({ items: [...d.items, { id: `i${Date.now().toString(36)}`, title: "", description: "", body: "" }] })}
            >
              <Plus />
              Add a row
            </Button>
          )}
        </EditorSection>
      );
    }
    case "verse": {
      const d = value.data;
      return (
        <EditorSection title="Verses" description="One a day, in order, starting again after the last. Leave a blank line between verses.">
          <Field
            label={`${d.verses.length} verses`}
            value={d.verses.join("\n\n")}
            onChange={(text) => data({ verses: text.split(/\n[ \t]*\n/) })}
            multiline
            rows={14}
          />
        </EditorSection>
      );
    }
  }
}
