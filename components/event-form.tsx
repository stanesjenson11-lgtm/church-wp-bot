"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Field, Toggle } from "@/components/fields";
import { useFormDialog } from "@/components/form-dialog";
import { MediaField } from "@/components/media-field";
import { QuestionEditor } from "@/components/question-editor";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { EventInputSchema, type ChurchEvent, type EventInput } from "@/lib/shared/blocks";
import { attempt } from "@/lib/use-load";

const BLANK: EventInput = {
  title: "",
  date: "",
  time: "",
  venue: "",
  details: "",
  imageId: null,
  capacity: null,
  signupOpen: true,
  signupCloses: null,
  askHeadcount: true,
  questions: [],
};

/** Add or edit an event. Members see it under Upcoming Events until the day has passed. */
export function EventForm({ event, onSaved }: { event?: ChurchEvent; onSaved: (e: ChurchEvent) => void }) {
  const { close } = useFormDialog();
  const [v, setV] = useState<EventInput>(() => {
    if (!event) return BLANK;
    const { id: _id, registered: _r, registrations: _n, ...input } = event;
    return input;
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<EventInput>) => setV((old) => ({ ...old, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = EventInputSchema.safeParse({
      ...v,
      questions: v.questions.map((q) => (q.options ? { ...q, options: q.options.map((o) => o.trim()).filter(Boolean) } : q)),
    });
    if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message ?? "Check the fields");
    setBusy(true);
    const saved = await attempt(
      () => (event ? api.updateEvent(event.id, parsed.data) : api.createEvent(parsed.data)),
      event ? "Event saved" : "Event added. Members can see it now.",
    );
    setBusy(false);
    if (saved) {
      onSaved(saved);
      close();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event name" value={v.title} onChange={(title) => set({ title })} max={60} required className="sm:col-span-2" />
        <Field label="Date" type="date" value={v.date} onChange={(date) => set({ date })} required />
        <Field label="Time" value={v.time} onChange={(time) => set({ time })} max={40} placeholder="6:00 PM" />
        <Field label="Place" value={v.venue} onChange={(venue) => set({ venue })} max={80} placeholder="Main Hall" className="sm:col-span-2" />
        <Field label="Details" value={v.details} onChange={(details) => set({ details })} max={800} multiline rows={3} className="sm:col-span-2" />
      </div>

      <MediaField label="Poster (optional)" hint="Shown above the details in WhatsApp." value={v.imageId} onChange={(imageId) => set({ imageId })} />

      <div className="space-y-4 rounded-[20px] bg-muted/60 p-4 squircle">
        <Toggle checked={v.signupOpen} onChange={(signupOpen) => set({ signupOpen })} label="Registration open" hint="Members get a Register button in the chat." />
        {v.signupOpen && (
          <>
            <Toggle
              checked={v.askHeadcount}
              onChange={(askHeadcount) => set({ askHeadcount })}
              label="Ask how many are coming"
              hint="One extra message. Turn off when each person registers alone."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Places (optional)"
                type="number"
                value={v.capacity === null ? "" : String(v.capacity)}
                onChange={(text) => set({ capacity: text === "" ? null : Math.max(1, Math.floor(Number(text)) || 1) })}
                hint="Leave empty for no limit."
              />
              <Field
                label="Last day to register (optional)"
                type="date"
                value={v.signupCloses ?? ""}
                onChange={(text) => set({ signupCloses: text || null })}
                hint="Empty: closes on the event day."
              />
            </div>
          </>
        )}
      </div>

      {v.signupOpen && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Extra questions</p>
          <p className="text-xs text-muted-foreground">Up to 5, such as “Any food allergies?”. Each one is one more message.</p>
          <QuestionEditor questions={v.questions} onChange={(questions) => set({ questions })} max={5} min={0} />
        </div>
      )}

      <Button type="submit" disabled={busy} className="h-11 w-full">
        {busy ? "Saving…" : event ? "Save event" : "Add event"}
      </Button>
    </form>
  );
}
