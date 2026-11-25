"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Nothing public lives here: the bot is on WhatsApp, the dashboard under /admin. */
export default function Home() {
  useEffect(() => {
    location.replace("/admin");
  }, []);
  return (
    <p className="m-auto p-8 text-sm text-muted-foreground">
      <Link href="/admin" className="text-ink underline-offset-4 hover:underline">
        Open the dashboard
      </Link>
    </p>
  );
}
