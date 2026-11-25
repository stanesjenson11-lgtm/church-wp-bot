import {
  Baby,
  BookOpen,
  CalendarDays,
  Church,
  CircleQuestionMark,
  ClipboardList,
  Clock,
  Droplets,
  HandCoins,
  HandHeart,
  HeartHandshake,
  House,
  ListTree,
  MapPin,
  Megaphone,
  MessageSquareHeart,
  MessageSquareText,
  MonitorPlay,
  Phone,
  Radio,
  Sparkles,
  Type,
  UserPlus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { Block, BlockInput, BlockType } from "@/lib/shared/blocks";

/** How each kind of menu item is named and drawn in the dashboard. */
export const TYPE_META: Record<BlockType, { label: string; icon: LucideIcon; sends: string }> = {
  text: { label: "Message", icon: MessageSquareText, sends: "Sends your text, with an optional picture or link." },
  location: { label: "Map pin", icon: MapPin, sends: "Sends a pin that opens in Google Maps." },
  events: { label: "Events", icon: CalendarDays, sends: "Lists upcoming events. Members can register in the chat." },
  form: { label: "Form", icon: ClipboardList, sends: "Asks questions one at a time and saves the answers to the Inbox." },
  submenu: { label: "List", icon: ListTree, sends: "Opens a list. Each row has its own text." },
  verse: { label: "Daily verse", icon: BookOpen, sends: "Sends a different verse each day." },
};

/** The lucide icon named by a preset in lib/shared/presets.ts. */
export const PRESET_ICONS: Record<string, LucideIcon> = {
  Baby,
  BookOpen,
  CalendarDays,
  Church,
  CircleHelp: CircleQuestionMark,
  ClipboardList,
  Clock,
  Droplets,
  HandCoins,
  HandHeart,
  HeartHandshake,
  House,
  ListTree,
  MapPin,
  Megaphone,
  MessageSquareHeart,
  MonitorPlay,
  Phone,
  Radio,
  Sparkles,
  Type,
  UserPlus,
  UsersRound,
};


/** A saved block back into the shape the API accepts. */
export function toInput(block: Block): BlockInput {
  const { id: _id, position: _position, updatedAt: _updatedAt, ...input } = block;
  return input as BlockInput;
}
