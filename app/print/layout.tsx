/**
 * The shell every PDF is printed from: no navigation, one A4-wide column, and
 * the print dialog opened once the page's data is in (each page renders its
 * own <AutoPrint ready>). "Save as PDF" makes the file.
 *
 * Not the authorisation boundary: the data comes from /api, which checks the
 * session; signed out, the request sends the browser to the login screen.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="light min-h-screen bg-white text-black">
      <main className="mx-auto max-w-[210mm] px-8 py-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
