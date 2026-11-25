import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy · Church WhatsApp bot" };

/**
 * The privacy policy Meta asks for before the app can go Live. Plain words,
 * covering what the bot keeps, who reads it, and how to have it deleted
 * (India's Digital Personal Data Protection Act, 2023).
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 md:py-16">
      <article className="space-y-8 text-[15px] leading-relaxed">
        <header className="space-y-2">
          <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em]">Privacy policy</h1>
          <p className="text-muted-foreground">For our church&apos;s WhatsApp bot. Last updated November 2026.</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">What we keep</h2>
          <p>When you message our WhatsApp number, we keep:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>your WhatsApp name and phone number, and when you last wrote to us;</li>
            <li>your answers when you fill in a form in the chat, such as a prayer request or a membership form;</li>
            <li>your registrations for church events, including how many people are coming.</li>
          </ul>
          <p>We don&apos;t keep a copy of every message, and we never keep photos, voice notes or files you send.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Why</h2>
          <p>
            Only to answer you, to pray for you, to follow up when you ask us to, and to know how many people are coming to an event.
            We never use it for advertising.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Who can see it</h2>
          <p>
            A small number of church staff and volunteers who run the bot. Prayer requests and pastoral requests are private:
            only our pastor and the prayer team can read them.
          </p>
          <p>
            <strong>We never sell or share your details with anyone.</strong> The bot runs on WhatsApp (Meta) and Cloudflare, who
            process the messages for us to deliver them.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">We don&apos;t message you first</h2>
          <p>The bot only replies when you write to it. Church announcements go on our WhatsApp Channel, which you can follow or leave any time.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Deleting your details</h2>
          <p>
            Send <strong>delete my data</strong> to our WhatsApp number at any time. Your name, number, form answers and event
            registrations are erased straight away, and the bot confirms when it&apos;s done. You can also ask the church office to
            do it for you.
          </p>
          <p>
            These are your rights under India&apos;s Digital Personal Data Protection Act, 2023. To correct your details, or for
            any question about your data, contact the church office.
          </p>
        </section>
      </article>
    </main>
  );
}
