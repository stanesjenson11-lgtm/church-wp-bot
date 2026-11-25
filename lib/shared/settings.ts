import { LIMITS } from "./blocks";

/**
 * Every fixed thing the bot says, plus the church profile. All editable in the
 * dashboard (Settings), so the bot can speak any one language. Placeholders in
 * {braces} are filled in by the bot.
 */
export type SettingField = {
  key: string;
  label: string;
  group: "Church" | "Menu" | "Forms" | "Events" | "Other" | "Cost";
  max: number;
  multiline?: boolean;
  help?: string;
  default: string;
};

export const SETTING_FIELDS = [
  // Church
  { key: "church_name", group: "Church", label: "Church name", max: 100, default: "[EDIT ME] Church" },
  { key: "office_phone", group: "Church", label: "Office phone", max: 40, default: "[EDIT ME] +91 00000 00000", help: "Given when something goes wrong." },
  { key: "channel_link", group: "Church", label: "WhatsApp Channel link", max: 200, default: "", help: "Announcements go here: posting on a Channel is free, messages from the bot are not." },

  // Menu
  { key: "welcome", group: "Menu", label: "Welcome message", max: LIMITS.interactiveBody, multiline: true, default: "Welcome to [EDIT ME] Church! 🙏\nHow can we help you today?", help: "The text above the menu." },
  { key: "menu_button", group: "Menu", label: "Menu button", max: LIMITS.button, default: "View options", help: "Opens the list of options." },
  { key: "menu_section", group: "Menu", label: "Menu heading", max: LIMITS.rowTitle, default: "Menu" },
  { key: "menu_label", group: "Menu", label: "“Back to menu” button", max: LIMITS.button, default: "Menu", help: "Shown under every answer." },
  { key: "unsupported", group: "Menu", label: "Photo, voice note or sticker received", max: 200, default: "Sorry, I can only read text messages 🙂" },

  // Forms
  { key: "cancel_hint", group: "Forms", label: "How to stop", max: LIMITS.footer, default: "Type cancel to stop" },
  { key: "skip_hint", group: "Forms", label: "How to skip a question", max: 100, default: "Type *skip* to leave this blank." },
  { key: "cancelled", group: "Forms", label: "Stopped", max: 200, default: "Cancelled. Nothing was saved." },
  { key: "text_only", group: "Forms", label: "Needs a typed answer", max: 200, default: "Please type your answer as text, or type *cancel*." },
  { key: "invalid_choice", group: "Forms", label: "Not one of the options", max: 200, default: "Please tap one of the options." },
  { key: "invalid_number", group: "Forms", label: "Not a number", max: 200, default: "Please reply with a number." },
  { key: "invalid_date", group: "Forms", label: "Not a date", max: 200, default: "Please reply with a date like 25-12-1990." },
  { key: "yes", group: "Forms", label: "Yes", max: LIMITS.button, default: "Yes" },
  { key: "no", group: "Forms", label: "No", max: LIMITS.button, default: "No" },
  { key: "choose", group: "Forms", label: "List button for choices", max: LIMITS.button, default: "Choose" },
  { key: "save_failed", group: "Forms", label: "Could not save", max: 300, default: "Sorry, we couldn't save that. Please call the church office: {office_phone}" },

  // Events
  { key: "events_button", group: "Events", label: "Events list button", max: LIMITS.button, default: "See events" },
  { key: "register", group: "Events", label: "Register button", max: LIMITS.button, default: "Register" },
  { key: "unregister", group: "Events", label: "Cancel registration button", max: LIMITS.button, default: "Cancel my spot" },
  { key: "headcount", group: "Events", label: "How many people", max: LIMITS.interactiveBody, default: "How many people are coming, including you?" },
  { key: "full", group: "Events", label: "Event is full", max: 200, default: "Sorry, this event is full." },
  { key: "closed", group: "Events", label: "Registration closed", max: 200, default: "Registration for this event is closed." },
  { key: "registered", group: "Events", label: "Registered", max: LIMITS.interactiveBody, multiline: true, default: "✅ You're registered for *{title}*\n{when}\n{people}\n\nReply *my events* to see or cancel.", help: "{title}, {when} and {people} are filled in." },
  { key: "already_registered", group: "Events", label: "Already registered", max: 200, default: "You're registered for this event ({people})." },
  { key: "unregistered", group: "Events", label: "Registration cancelled", max: 300, default: "Your registration for *{title}* is cancelled." },
  { key: "my_events", group: "Events", label: "My events heading", max: LIMITS.interactiveBody, default: "Your registrations. Tap one to see it or cancel." },
  { key: "my_events_empty", group: "Events", label: "No registrations", max: 200, default: "You haven't registered for any upcoming events." },
  { key: "people_one", group: "Events", label: "1 person", max: 40, default: "1 person" },
  { key: "people_many", group: "Events", label: "Several people", max: 40, default: "{n} people", help: "{n} is the number." },

  // Other
  { key: "deleted", group: "Other", label: "Data deleted", max: 300, default: "Your details, registrations and requests have been deleted from our records." },
  { key: "logged_out", group: "Other", label: "Admin signed out everywhere", max: 200, default: "You've been signed out of the dashboard on every device." },

  // Cost
  { key: "free_per_month", group: "Cost", label: "Free replies a month", max: 10, default: "1000", help: "Meta's free allowance per number. Check WhatsApp Manager → Billing." },
  { key: "rate_per_message", group: "Cost", label: "Price per reply after that (₹, incl. GST)", max: 10, default: "0.1357", help: "₹0.115 + 18% GST in India from 1 Oct 2026." },
] as const satisfies readonly SettingField[];

export type SettingKey = (typeof SETTING_FIELDS)[number]["key"];
export type Settings = Record<SettingKey, string>;

export const DEFAULT_SETTINGS = Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, f.default])) as Settings;

/** "{title} on {when}" with values; unknown placeholders are left alone. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}
