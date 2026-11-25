"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";

import { Field, Toggle, selectClass } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LIMITS, type Question } from "@/lib/shared/blocks";

const KINDS: { value: Question["kind"]; label: string }[] = [
  { value: "text", label: "Typed answer" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date (DD-MM-YYYY)" },
  { value: "choice", label: "Pick one option" },
  { value: "yesno", label: "Yes or no" },
];

const newId = () => `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Move item `i` by `by` places, returning a new array. */
export function move<T>(list: T[], i: number, by: number): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/**
 * The questions a form (or an event's sign-up) asks, one message each. The
 * bot asks them in this order; options of three or fewer become buttons,
 * more become a list.
 */
export function QuestionEditor({
  questions,
  onChange,
  max = 10,
  min = 1,
}: {
  questions: Question[];
  onChange: (next: Question[]) => void;
  max?: number;
  min?: number;
}) {
  const set = (i: number, patch: Partial<Question>) => onChange(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {questions.map((q, i) => (
          <li key={q.id} className="space-y-3 rounded-[20px] bg-muted/60 p-4 squircle">
            <div className="flex items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-card text-xs font-semibold tabular-nums">{i + 1}</span>
              <span className="flex-1 text-sm font-medium">Question {i + 1}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => onChange(move(questions, i, -1))}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move question ${i + 1} down`} disabled={i === questions.length - 1} onClick={() => onChange(move(questions, i, 1))}>
                <ArrowDown />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove question ${i + 1}`} disabled={questions.length <= min} onClick={() => onChange(questions.filter((_, j) => j !== i))}>
                <X />
              </Button>
            </div>
            <Field label="What the bot asks" value={q.label} onChange={(label) => set(i, { label })} max={LIMITS.interactiveBody} multiline rows={2} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${q.id}-kind`}>Answer</Label>
                <select
                  id={`${q.id}-kind`}
                  value={q.kind}
                  onChange={(e) => {
                    const kind = e.target.value as Question["kind"];
                    set(i, { kind, options: kind === "choice" ? (q.options?.length ? q.options : ["Option 1", "Option 2"]) : undefined });
                  }}
                  className={selectClass}
                >
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-1">
                <Toggle checked={q.optional} onChange={(optional) => set(i, { optional })} label="Can be skipped" hint="Members can type skip." />
              </div>
            </div>
            {q.kind === "choice" && (
              <Field
                label="Options, one per line"
                value={(q.options ?? []).join("\n")}
                onChange={(text) => set(i, { options: text.split("\n").map((o) => o.slice(0, LIMITS.rowTitle)).slice(0, LIMITS.listRows) })}
                multiline
                rows={3}
                hint={`Up to ${LIMITS.listRows} options of ${LIMITS.rowTitle} characters. Three or fewer show as buttons; more open a list.`}
              />
            )}
          </li>
        ))}
      </ol>
      {questions.length < max && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange([...questions, { id: newId(), label: "", kind: "text", optional: false }])}
          className="gap-1.5"
        >
          <Plus />
          Add a question
        </Button>
      )}
    </div>
  );
}
