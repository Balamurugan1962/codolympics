"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
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
    if (error) { setError("Sign-in failed. Check your display name and password."); return; }
    router.push("/"); router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader title="Sign in" />
      <CardBody>
        <form onSubmit={submit}>
          {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
          <Field label="Display name"><Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" required /></Field>
          <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></Field>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          New here? <Link href="/register" className="font-semibold text-green-dark">Register</Link>
        </p>
        <p className="mt-2 text-center text-xs text-faint">Signing in here ends any session you have open elsewhere.</p>
      </CardBody>
    </Card>
  );
}
