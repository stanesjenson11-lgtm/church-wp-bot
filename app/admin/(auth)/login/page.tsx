"use client";

import { MessageCircle, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { QrCode } from "@/components/qr-code";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";
import type { LoginStart } from "@/lib/shared/api";
import { cn } from "@/lib/utils";

/**
 * Sign in by WhatsApp: this screen shows a one-time code, the admin sends
 * "LOGIN <code>" to the church bot from their own phone, and the bot (which
 * already knows which numbers are admins) approves this browser. No password,
 * and the bot doesn't reply, so it costs nothing.
 */
export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState<LoginStart | null>(null);
  const [state, setState] = useState<"waiting" | "expired" | "error">("waiting");
  const [problem, setProblem] = useState<string | null>(null);

  const start = useCallback(async () => {
    setState("waiting");
    setLogin(null);
    try {
      setLogin(await api.loginStart());
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : null);
      setState("error");
    }
  }, []);

  useEffect(() => {
    // A setup-key link (/admin/login#key=…): the key never leaves the browser
    // except in this request, and is wiped from the address bar at once.
    const key = location.hash.startsWith("#key=") ? decodeURIComponent(location.hash.slice(5)) : "";
    if (key) {
      history.replaceState(null, "", location.pathname);
      api.loginWithKey(key).then(
        () => location.assign("/admin"),
        () => void start(),
      );
      return;
    }
    // Already signed in on this browser: straight to the dashboard.
    api.me().then(() => router.replace("/admin"), () => void start());
  }, [router, start]);

  useEffect(() => {
    if (!login || state !== "waiting") return;
    const timer = setInterval(async () => {
      try {
        const { status } = await api.loginPoll();
        if (status === "approved") {
          clearInterval(timer);
          location.assign("/admin");
        } else if (status === "expired") {
          setState("expired");
        }
      } catch {
        // A dropped request on a weak connection; the next tick tries again.
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [login, state]);

  const message = login ? `LOGIN ${login.code}` : "";

  return (
    <Card>
      <CardContent className="space-y-5 pt-1 text-center">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Sign in with WhatsApp</h2>
          <p className="text-[13px] text-muted-foreground">
            Send this code to the church bot from the phone number your admin added.
          </p>
        </div>

        <div aria-live="polite" className="rounded-[22px] bg-muted px-4 py-5 squircle">
          {state === "error" ? (
            <p className="text-sm text-destructive">
              {problem ?? "The sign-in service didn't answer. Check your connection and try again."}
            </p>
          ) : login ? (
            <>
              <p className="text-xs font-medium text-muted-foreground">Your code</p>
              <p className={cn("mt-1 text-[2.25rem] leading-none font-semibold tracking-[0.12em] tabular-nums", state === "expired" && "text-muted-foreground line-through")}>
                {login.code.slice(0, 3)} {login.code.slice(3)}
              </p>
            </>
          ) : (
            <div aria-hidden className="mx-auto h-[3.6rem] w-44 shimmer rounded-xl" />
          )}
        </div>

        {login && state === "waiting" && (
          <>
            <a
              href={login.link}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: "lg" }), "h-11 w-full gap-2")}
            >
              <MessageCircle className="size-[18px]" strokeWidth={1.75} />
              Send on WhatsApp
            </a>

            {/* On a computer, the phone's camera opens the same message. */}
            <div className="hidden flex-col items-center gap-2 md:flex">
              <QrCode value={login.link} label="QR code that opens WhatsApp with the sign-in message" className="size-36 text-foreground" />
              <p className="text-xs text-muted-foreground">On a computer? Scan with your phone&apos;s camera.</p>
            </div>

            <p className="text-xs text-muted-foreground">
              Or type <span className="font-medium text-foreground">{message}</span> in a chat with{" "}
              <span className="font-medium whitespace-nowrap text-foreground">+{login.botNumber}</span>
            </p>

            <p className="flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
              <span aria-hidden className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              Waiting for your message…
            </p>
          </>
        )}

        {(state === "expired" || state === "error") && (
          <Button onClick={() => void start()} className="w-full gap-2" size="lg">
            <RotateCw className="size-4" strokeWidth={1.75} />
            Get a new code
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          {state === "expired" ? "That code has expired. Codes last 5 minutes." : "Only numbers added under Admins can sign in."}
        </p>

        <SetupKey />
      </CardContent>
    </Card>
  );
}

/** The temporary way in before WhatsApp is connected (the SETUP_KEY secret). */
function SetupKey() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-ink underline-offset-4 hover:underline">
        Sign in with a setup key
      </button>
    );
  }
  return (
    <form
      className="space-y-2 border-t pt-4 text-left"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api.loginWithKey(key.trim());
          location.assign("/admin");
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Couldn't sign in. Try again.");
          setBusy(false);
        }
      }}
    >
      <Label htmlFor="setup-key">Setup key</Label>
      <Input id="setup-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} required />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" variant="secondary" className="w-full" disabled={busy || !key.trim()}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
