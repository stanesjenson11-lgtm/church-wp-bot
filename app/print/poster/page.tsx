"use client";

import { QrCode } from "@/components/qr-code";
import { api } from "@/lib/api";
import { prettyPhone } from "@/lib/format";
import { useLoad } from "@/lib/use-load";

import { AutoPrint } from "../auto-print";

/** An A4 notice-board poster: the QR code, the number, and what members can ask for. */
export default function PosterPage() {
  const { data } = useLoad(() => Promise.all([api.me(), api.blocks()]));
  const [me, blocks] = data ?? [];
  const items = (blocks ?? []).filter((b) => b.enabled).map((b) => b.title);
  const link = me ? `https://wa.me/${me.botNumber}?text=Hi` : "";

  return (
    <>
      <AutoPrint ready={!!data} />
      {me && (
        <article className="mx-auto flex min-h-[260mm] flex-col items-center justify-center gap-10 text-center">
          <header className="space-y-3">
            <p className="text-[15px] font-medium text-neutral-500">{me.churchName}</p>
            <h1 className="text-[44px] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">Chat with us on WhatsApp</h1>
          </header>
          <QrCode value={link} label="Scan to open WhatsApp" className="size-[95mm] text-black" />
          <div className="space-y-1">
            <p className="text-lg">Scan with your phone camera, or message</p>
            <p className="text-[28px] font-semibold tabular-nums">{prettyPhone(me.botNumber)}</p>
          </div>
          {items.length > 0 && (
            <p className="max-w-[150mm] text-[15px] leading-relaxed text-neutral-600">
              Send <strong className="text-black">Hi</strong> for {items.join(", ").replace(/, ([^,]*)$/, " and $1")}.
            </p>
          )}
        </article>
      )}
    </>
  );
}
