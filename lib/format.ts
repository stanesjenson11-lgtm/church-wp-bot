/**
 * Display formatting.
 *
 * Storage stays ISO (YYYY-MM-DD) in Postgres `date` columns — that is what
 * sorts, compares and indexes correctly, and it is what every query and test
 * speaks. DD-MM-YYYY is a presentation concern and lives only here.
 *
 * There is no parseDate counterpart: every date is now ENTERED through
 * <input type="date">, which already yields ISO. Reading a typed date back
 * was a whole class of validation error that no longer exists.
 */

/** India observes no daylight saving, so the offset is a constant. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * The IST calendar date of `at`, as YYYY-MM-DD.
 *
 * Lives here rather than with the queries because validation needs it too,
 * and validation runs on both sides of the wire.
 */
export function istDate(at: Date = new Date()): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/** An exact decimal string as ₹. Never parse an amount for arithmetic. */
export function formatMoney(amount: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  return inr.format(Number(amount));
}

/**
 * A WhatsApp "click to chat" link with the message filled in.
 *
 * Phones are stored as bare digits (lib/validation/fields.ts), and most are a
 * 10-digit Indian mobile with no country code, which wa.me needs: those get
 * 91 in front. Anything else is passed through as already international.
 */
export function whatsappLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

/** ISO date (YYYY-MM-DD) to DD-MM-YYYY for display. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return "—";
  return `${day}-${month}-${year}`;
}

/** A timestamp as DD-MM-YYYY HH:mm in IST. */
export function formatDateTime(at: Date | string | null | undefined): string {
  if (!at) return "—";
  const date = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(date.getTime())) return "—";
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const iso = ist.toISOString();
  return `${formatDate(iso.slice(0, 10))} ${iso.slice(11, 16)}`;
}

/**
 * Whole years old, or null when the date of birth is not on record.
 *
 * Compared as calendar parts against today in IST, not by subtracting
 * timestamps: a member turns a year older on their birthday where they live,
 * and dividing elapsed milliseconds by 365.25 puts that a day out either side.
 * Matches what the members filter asks Postgres for, so a member found by
 * "age 30 to 40" does not then read as 29 on their own page.
 */
export function ageFrom(dateOfBirth: string | null | undefined, today = istDate()): number | null {
  if (!dateOfBirth) return null;
  const [by, bm, bd] = dateOfBirth.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (!by || !bm || !bd) return null;

  // Minus one when the birthday has not come round yet this year.
  const age = ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
  return age >= 0 ? age : null;
}

/** "+91 98765 43210" from WhatsApp's 919876543210; other countries as "+<digits>". */
export function prettyPhone(wa: string): string {
  return wa.startsWith("91") && wa.length === 12 ? `+91 ${wa.slice(2, 7)} ${wa.slice(7)}` : `+${wa}`;
}
