import qrcode from "qrcode-generator";

/**
 * A QR code as crisp SVG squares in the current text colour, so it follows the
 * theme on screen and prints black on paper. Medium error correction: still
 * scans from a slightly creased notice-board print.
 */
export function QrCode({ value, className, label }: { value: string; className?: string; label: string }) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  // A 2-module quiet zone, the minimum scanners need, drawn as padding.
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label={label} className={className} shapeRendering="crispEdges">
      <path d={d} fill="currentColor" />
    </svg>
  );
}
