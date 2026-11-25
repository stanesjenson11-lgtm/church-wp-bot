"use client";

import { KeyRound, LogOut, Trash } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EditorSection } from "@/components/block-editor";
import { Confirm } from "@/components/confirm";
import { EmptyState } from "@/components/empty-state";
import { Field, PageHead, selectClass } from "@/components/fields";
import { useViewer } from "@/components/shell/app-shell";
import { ListSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { formatDateTime, prettyPhone } from "@/lib/format";
import { AdminInputSchema, type AdminInput } from "@/lib/shared/blocks";
import { attempt, useLoad } from "@/lib/use-load";

/** "Chrome on Android" from a user-agent string, for the sessions list. */
function device(ua: string): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "A browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

/**
 * Who can sign in, and where they're signed in now. Admins see everything;
 * editors change the menu and events but never private answers and never this page.
 */
export default function AdminsPage() {
  const viewer = useViewer();
  if (viewer.role !== "admin") {
    return (
      <div className="space-y-6">
        <PageHead title="Admins" />
        <div className="tile">
          <EmptyState icon={KeyRound} title="Only admins can manage sign-ins" hint="Ask an admin if someone needs to be added or removed." />
        </div>
      </div>
    );
  }
  return <Admins myPhone={viewer.phone} />;
}

function Admins({ myPhone }: { myPhone: string }) {
  const { data, set } = useLoad(() => Promise.all([api.admins(), api.sessions()]));
  const [form, setForm] = useState<AdminInput>({ phone: "", name: "", role: "editor" });
  const [busy, setBusy] = useState(false);
  if (!data) return <ListSkeleton />;
  const [admins, sessions] = data;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = AdminInputSchema.safeParse({ ...form, phone: form.phone.replace(/\D/g, "") });
    if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message ?? "Check the number");
    setBusy(true);
    const row = await attempt(() => api.addAdmin(parsed.data), `${parsed.data.name} can now sign in`);
    setBusy(false);
    if (row) {
      set([[...admins.filter((a) => a.phone !== row.phone), row], sessions]);
      setForm({ phone: "", name: "", role: "editor" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHead title="Admins" description="People who can sign in. They sign in by sending a code to the bot from these numbers." />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="tile overflow-hidden">
          <ul className="divide-y">
            {admins.map((a) => (
              <li key={a.phone} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">
                  {a.name.trim()[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {a.name}
                    {a.phone === myPhone && <span className="font-normal text-muted-foreground"> (you)</span>}
                  </span>
                  <span className="block text-[13px] text-muted-foreground tabular-nums">{prettyPhone(a.phone)}</span>
                </span>
                <Badge variant={a.role === "admin" ? "default" : "secondary"}>{a.role === "admin" ? "Admin" : "Editor"}</Badge>
                {a.phone !== myPhone && (
                  <Confirm
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${a.name}`}>
                        <Trash />
                      </Button>
                    }
                    title={`Remove ${a.name}?`}
                    description="They're signed out everywhere and can't sign in again unless re-added."
                    action="Remove"
                    onConfirm={async () => {
                      if (await attempt(() => api.removeAdmin(a.phone), `${a.name} removed`)) {
                        set([admins.filter((x) => x.phone !== a.phone), sessions.filter((s) => s.phone !== a.phone)]);
                      }
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>

        <EditorSection title="Add someone" description="Use the WhatsApp number on their phone, with the country code.">
          <form onSubmit={add} className="space-y-4">
            <Field label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} max={60} required />
            <Field
              label="WhatsApp number"
              type="tel"
              value={form.phone}
              onChange={(phone) => setForm({ ...form, phone })}
              placeholder="919876543210"
              hint="Digits only: 91 then the 10-digit mobile number."
              required
            />
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <select id="role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminInput["role"] })} className={selectClass}>
                <option value="editor">Editor: menu, events and settings</option>
                <option value="admin">Admin: everything, including private answers</option>
              </select>
            </div>
            <Button type="submit" disabled={busy} className="h-11 w-full">
              {busy ? "Adding…" : "Add"}
            </Button>
          </form>
        </EditorSection>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold tracking-[-0.01em]">Signed in now</h3>
          <p className="text-[13px] text-muted-foreground">
            Sessions last 30 days. Sending <span className="font-medium text-foreground">logout all</span> to the bot also signs a person out everywhere.
          </p>
        </div>
        <ul className="tile divide-y overflow-hidden">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {s.name} · {device(s.userAgent)}
                  {s.current && <span className="font-normal text-muted-foreground"> (this browser)</span>}
                </span>
                <span className="block text-[13px] text-muted-foreground tabular-nums">Signed in {formatDateTime(s.createdAt)}</span>
              </span>
              {!s.current && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={async () => {
                    if (await attempt(() => api.revokeSession(s.id), "Signed out")) set([admins, sessions.filter((x) => x.id !== s.id)]);
                  }}
                >
                  <LogOut />
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
