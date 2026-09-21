"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SimpleCombobox } from "@/components/ui/combobox";
import { authClient } from "@/lib/auth-client";
import { api, errorMessage } from "@/lib/client";
import { LANGUAGES } from "@/lib/languages";

// Not signed in yet, so /api/languages is unreachable; this list is what the
// worker image ships. It only sets which language the editor opens in — every
// language stays available on every question, changeable per submission.

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.post("/api/register", { username: username.trim(), password, preferred_language: language });
      const { error } = await authClient.signIn.username({ username: username.trim().replace(/\s+/g, "_").toLowerCase(), password });
      if (error) throw new Error("Registered, but sign-in failed. Try signing in.");
      router.push("/welcome"); router.refresh();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-[18px] font-semibold tracking-[-0.012em]">Create your account</h1>
      <p className="mt-1 text-[12.5px] text-muted-foreground">One person, one account, one seat.</p>

      <form onSubmit={submit} className="mt-6 space-y-3.5">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Field label="Display name" help="How you appear on the leaderboard. It cannot be taken by anyone else.">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required minLength={2} maxLength={32} placeholder="e.g. Bala" />
        </Field>
        <Field label="Password" hint="8+ characters" help="An organiser can reset this for you if you forget it.">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} placeholder="At least 8 characters" />
        </Field>
        <Field label="Language to start in" help="Only the editor's default. You can switch language on any question, at any time, as often as you like.">
          <SimpleCombobox className="w-full" size="default" value={language} onValueChange={setLanguage}
            options={LANGUAGES} />
        </Field>
        <Button type="submit" className="w-full" loading={busy}>Create account</Button>
      </form>

      <p className="mt-5 text-center text-[12.5px] text-muted-foreground">
        Already registered? <Link href="/login" className="font-semibold text-brand-deep hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
