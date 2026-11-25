"use client";

import { ImagePlus, Trash } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { attempt } from "@/lib/use-load";

const LONGEST = 1600;

/**
 * Shrinks a photo in the browser to a JPEG no wider or taller than 1600 px.
 * WhatsApp only takes JPEG or PNG by link, and the Worker stores the bytes in
 * D1, whose rows top out at 2 MB; a phone photo is usually 3–8 MB.
 */
async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONGEST / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  // JPEG has no transparency: a transparent QR code would turn black without this.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.85, 0.75, 0.6]) {
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", quality));
    if (blob && blob.size <= 1_500_000) return blob;
  }
  throw new Error("This picture is too detailed to send. Try a smaller one.");
}

/** Pick a picture, shrink it, upload it; `value` is the media id or null. */
export function MediaField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    const result = await attempt(async () => api.uploadMedia(await toJpeg(file)), "Picture uploaded");
    setBusy(false);
    if (result) onChange(result.id);
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <input
        ref={picker}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      {value ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- served by the Worker from D1 */}
          <img src={`/media/${value}`} alt="" className="size-20 rounded-2xl bg-muted object-cover squircle" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => picker.current?.click()}>
              Replace
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange(null)}>
              <Trash />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => picker.current?.click()}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-input px-4 py-3 text-left text-sm text-muted-foreground transition-[background-color,scale] duration-150 ease-out hover:bg-muted active:scale-[0.99] disabled:opacity-60"
        >
          <ImagePlus className="size-5 shrink-0" strokeWidth={1.75} />
          <span>{busy ? "Uploading…" : "Add a picture"}</span>
        </button>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
