"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Form pieces the editors share. WhatsApp's character limits show as a quiet
 * counter that only speaks up near the limit, so a long welcome message is
 * guided rather than refused at save time.
 */

export const textareaClass =
  "w-full min-w-0 rounded-lg border border-input bg-card px-2.5 py-2 text-base leading-relaxed transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

/** The same look as church-members' native selects. */
export const selectClass = "h-9 w-full rounded-md border bg-card px-3 text-sm";

function Counter({ length, max, id }: { length: number; max: number; id: string }) {
  const near = length > max * 0.85;
  const over = length > max;
  return (
    <span
      id={id}
      aria-live={near ? "polite" : "off"}
      className={cn(
        "text-xs tabular-nums transition-colors",
        over ? "font-medium text-destructive" : near ? "text-ink" : "text-muted-foreground",
      )}
    >
      {over ? `${length - max} too long` : `${length} / ${max}`}
    </span>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  hint?: React.ReactNode;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  type?: string;
  className?: string;
  /** Shown under the field in red, e.g. a server validation message. */
  error?: string;
};

/** A labelled text field with an optional WhatsApp-limit counter. */
export function Field({ label, value, onChange, max, hint, placeholder, multiline, rows = 4, required, type = "text", className, error }: FieldProps) {
  const id = useId();
  const over = max !== undefined && value.length > max;
  const describedBy = [max !== undefined && `${id}-count`, hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    value,
    placeholder,
    required,
    "aria-invalid": over || !!error || undefined,
    "aria-describedby": describedBy,
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {max !== undefined && <Counter length={value.length} max={max} id={`${id}-count`} />}
      </div>
      {multiline ? (
        <textarea {...common} rows={rows} onChange={(e) => onChange(e.target.value)} className={cn(textareaClass, "field-sizing-content min-h-20")} />
      ) : (
        <Input {...common} type={type} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** An on/off switch with its label; a real button with role="switch" for keyboards and screen readers. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  hideLabel = false,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  hideLabel?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const button = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-[background-color] duration-200 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
        checked ? "bg-primary" : "bg-foreground/15",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-6 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-[translate] duration-200 ease-out",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
  if (hideLabel) return button;
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </label>
      {button}
    </div>
  );
}

/** A page's heading row: title, one line on what it's for, and its actions. */
export function PageHead({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
