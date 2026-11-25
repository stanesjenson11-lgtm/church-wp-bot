"use client";

import { useEffect, useState } from "react";

import { EditorSection } from "@/components/block-editor";
import { Field, PageHead } from "@/components/fields";
import { StackSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { SETTING_FIELDS, type SettingField, type Settings } from "@/lib/shared/settings";
import { attempt, useLoad } from "@/lib/use-load";

const GROUPS: { key: SettingField["group"]; title: string; description: string }[] = [
  { key: "Church", title: "Church", description: "Your details, used across the bot." },
  { key: "Menu", title: "Menu", description: "The welcome and the buttons around every answer." },
  { key: "Forms", title: "Forms", description: "What the bot says while it asks questions." },
  { key: "Events", title: "Event registration", description: "{title}, {when}, {people} and {n} are filled in by the bot." },
  { key: "Other", title: "Other messages", description: "Replies to special commands." },
  { key: "Cost", title: "Cost", description: "Used for the meter on the dashboard. Check WhatsApp Manager → Billing for today's prices." },
];

/**
 * Every fixed thing the bot says, in one place, so it can speak any one
 * language. Generated from SETTING_FIELDS, so a new phrase in the bot shows up
 * here without touching this page.
 */
export default function SettingsPage() {
  const { data } = useLoad(api.settings);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setDraft(data);
      setSaved(data);
    }
  }, [data]);

  if (!draft || !saved) return <StackSkeleton />;
  const changed = (Object.keys(draft) as (keyof Settings)[]).filter((k) => draft[k] !== saved[k]);
  const tooLong = SETTING_FIELDS.some((f) => (draft[f.key] ?? "").length > f.max);

  async function save() {
    setBusy(true);
    const patch = Object.fromEntries(changed.map((k) => [k, draft![k]])) as Partial<Settings>;
    const next = await attempt(() => api.saveSettings(patch), "Saved. The bot uses it from the next message.");
    setBusy(false);
    if (next) {
      setSaved(next);
      setDraft(next);
    }
  }

  return (
    <div className="space-y-6">
      <PageHead title="Settings" description="Your church's details and every phrase the bot uses. Write them in any language.">
        <Button onClick={() => void save()} disabled={busy || changed.length === 0 || tooLong} className="h-11 px-5">
          {busy ? "Saving…" : changed.length ? `Save ${changed.length} change${changed.length > 1 ? "s" : ""}` : "Saved"}
        </Button>
      </PageHead>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {GROUPS.map((g) => (
          <EditorSection key={g.key} title={g.title} description={g.description}>
            {SETTING_FIELDS.filter((f) => f.group === g.key).map((f: SettingField) => (
              <Field
                key={f.key}
                label={f.label}
                value={draft[f.key as keyof Settings] ?? ""}
                onChange={(value) => setDraft({ ...draft, [f.key]: value })}
                max={f.max}
                multiline={f.multiline}
                rows={3}
                hint={f.help}
                placeholder={f.default}
              />
            ))}
          </EditorSection>
        ))}
      </div>
    </div>
  );
}
