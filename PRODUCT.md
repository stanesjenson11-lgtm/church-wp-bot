# Product

> Derived from the approved build plan and the user's decisions of 2026-11-25
> (C:\Users\stane\.claude\plans\iridescent-whistling-balloon.md). Confirm or
> adjust with the user on the next design pass.

## Register

product

## Users
Church admins and volunteers: a pastor, an office secretary, a youth leader. Many are not developers. They open the dashboard on a phone between services or on the office laptop during the week. Their jobs are to change what the WhatsApp bot says (service timings, giving details, forms), add an event and watch registrations come in, read prayer requests and membership forms, and keep an eye on how many paid WhatsApp replies the month has used.

## Product Purpose
This is the control room for the church's reply-only WhatsApp bot. Each menu item in the bot is a "template" block, and the dashboard edits them. It shows exactly what members will see before anything is saved. It collects event sign-ups and form answers in one place, and it keeps the free 1,000 replies a month in view so the church stays near ₹0. Success means a volunteer can update Sunday's timings in under a minute without fear of breaking the bot.

## Brand Personality
Calm, trustworthy and warm. It's the same voice as the church-members app: Apple-like quiet confidence, burgundy as the church's colour, plain words instead of jargon. Copy talks to a volunteer, not an engineer: "Free replies this month", not "API usage".

## Anti-references
- Generic SaaS admin templates: purple gradients, hero-metric rows, identical icon-card grids.
- Developer consoles: raw JSON, IDs on screen, terminal styling.
- Anything that departs from the church-members superadmin shell. The user asked for an exact 1:1 match: floating glass pill nav, floating rail and phone tab bar.

## Design Principles
1. **Show the message, not the form.** Every edit sits beside a live WhatsApp preview, so what you type is what members get.
2. **Cost is always visible.** Each reply may cost money after 1,000 a month, so the meter is never more than a glance away.
3. **Earned familiarity.** Reuse the church-members vocabulary (tiles, glass, rise, sheets) so the two apps feel like one product.
4. **Limits are guidance, not errors.** WhatsApp's character limits show as gentle counters before they ever become a failed save.
5. **Private by default.** Prayer and pastoral requests are visibly marked private, and editors never see them.

## Accessibility & Inclusion
WCAG 2.2 AA. Tap targets of at least 44 px (many users are on phones). Reduced motion and reduced transparency are honoured, as globals.css already does. Status is never shown by colour alone. Text is plain English, and older volunteers must be able to read it at default zoom.
