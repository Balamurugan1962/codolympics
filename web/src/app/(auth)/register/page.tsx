"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { api, errorMessage } from "@/lib/client";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [languages, setLanguages] = useState<{ key: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Not signed in yet, so /api/languages is unavailable; a fixed list is fine here.
    setLanguages([["cpp", "C++"], ["c", "C"], ["python", "Python 3"], ["pypy", "PyPy"], ["java", "Java"], ["javascript", "JavaScript"]].map(([key, name]) => ({ key, name })));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.post("/api/register", { username: username.trim(), password, preferred_language: language });
      const { error } = await authClient.signIn.username({ username: username.trim().replace(/\s+/g, "_").toLowerCase(), password });
      if (error) throw new Error("registered, but sign-in failed — try signing in");
      router.push("/dashboard"); router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader title="Register" />
      <CardBody>
        <form onSubmit={submit}>
          {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
          <Field label="Display name" hint="This is how you appear on the leaderboard. One person, one account."><Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required minLength={2} maxLength={32} /></Field>
          <Field label="Password" hint="At least 8 characters. An organiser can reset it if you forget."><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></Field>
          <Field label="Preferred language" hint="So we know what you expect to code in.">
            <Select value={language} onChange={(e) => setLanguage(e.target.value)}>{languages.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}</Select>
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Registering…" : "Register"}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">Already registered? <Link href="/login" className="font-semibold text-green-dark">Sign in</Link></p>
      </CardBody>
    </Card>
  );
}
