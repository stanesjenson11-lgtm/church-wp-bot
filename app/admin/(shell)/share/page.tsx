"use client";

import { Check, Copy, Printer } from "lucide-react";
import { useState } from "react";

import { PageHead } from "@/components/fields";
import { QrCode } from "@/components/qr-code";
import { useViewer } from "@/components/shell/app-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { prettyPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * How members find the bot: a link that opens a chat with "Hi" already typed,
 * and a QR poster for the notice board, bulletin and screen slides.
 */
export default function SharePage() {
  const { botNumber, churchName } = useViewer();
  const link = `https://wa.me/${botNumber}?text=Hi`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (!botNumber) {
    return (
      <div className="space-y-6">
        <PageHead title="Share" description="The bot's number isn't set yet." />
        <p className="tile p-5 text-sm text-muted-foreground">
          Set BOT_NUMBER in the Worker settings (digits only, with the country code), then come back for the link and poster.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHead title="Share" description="Put the link in your bulletin and the QR code on the notice board. Messages members send are free for the church." />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <section className="tile space-y-4 p-5 [--secondary:var(--muted)]">
          <div>
            <h3 className="text-base font-semibold tracking-[-0.01em]">Chat link</h3>
            <p className="text-[13px] text-muted-foreground">Opens WhatsApp with “Hi” typed in a chat with {prettyPhone(botNumber)}.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{link}</code>
            <Button size="sm" variant="outline" onClick={() => void copy()} className="gap-1.5" aria-live="polite">
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="space-y-1 text-[13px] text-muted-foreground">
            <p>Ideas for where to use it:</p>
            <ul className="list-inside list-disc space-y-0.5">
              <li>The Sunday bulletin and the projector slide before service</li>
              <li>Your WhatsApp Channel description and Instagram bio</li>
              <li>The church's Google Maps listing, as the website</li>
            </ul>
          </div>
        </section>

        <section className="tile flex flex-col items-center gap-4 p-6 text-center">
          <p className="text-lg font-semibold tracking-[-0.02em]">{churchName}</p>
          <QrCode value={link} label={`QR code for a WhatsApp chat with ${churchName}`} className="size-48 text-foreground" />
          <p className="text-sm text-muted-foreground">Scan to chat with us on WhatsApp</p>
          <a href="/print/poster" target="_blank" rel="noopener" className={cn(buttonVariants(), "h-11 w-full gap-2")}>
            <Printer className="size-[18px]" strokeWidth={1.75} />
            Print the poster
          </a>
        </section>
      </div>
    </div>
  );
}
