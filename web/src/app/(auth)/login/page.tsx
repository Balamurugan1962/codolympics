"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await authClient.signIn.username({ username: username.trim().replace(/\s+/g, "_").toLowerCase(), password });
    setBusy(false);
    // Never say which field was wrong (US-F1-01).
    if (error) { setError(error.status === 429 ? "Too many attempts. Wait a moment and try again." : "Sign-in failed. Check your display name and password."); return; }
    router.push("/"); router.refresh();
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-[18px] font-semibold tracking-[-0.012em]">Sign in</h1>
      <p className="mt-1 text-[12.5px] text-muted-foreground">Use the display name you registered with.</p>

      <form onSubmit={submit} className="mt-6 space-y-3.5">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Field label="Display name">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" required placeholder="e.g. Bala" />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required placeholder="••••••••" />
        </Field>
        <Button type="submit" className="w-full" loading={busy}>Sign in</Button>
      </form>

      <p className="mt-5 text-center text-[12.5px] text-muted-foreground">
        First time here? <Link href="/register" className="font-semibold text-brand-deep hover:underline">Register</Link>
      </p>
      <p className="mt-5 flex items-start gap-2 rounded-box bg-muted px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
        <Icon.Info size={14} className="mt-0.5 shrink-0 text-faint" />
        Signing in here ends any session you have open on another machine. That is deliberate — one seat per person.
      </p>
    </div>
  );
}
