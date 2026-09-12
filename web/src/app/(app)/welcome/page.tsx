"use client";

/** First sign-in: what Codolympics is, how the day runs, the rules that matter. One button. */
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/icons";
import { Mark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { PageBody } from "@/components/ui/page";

const STEPS = [
  { icon: <Icon.Puzzle size={18} />, title: "Section A · Puzzles", body: "Logical puzzles, answered in any order. Change any answer until the section closes, then press Finish to record your time." },
  { icon: <Icon.Bug size={18} />, title: "Section B · Hacking", body: "Each given solution is wrong somewhere. Find an input that breaks it. The first hack on each solution scores." },
  { icon: <Icon.Gavel size={18} />, title: "Auction", body: "Finalists bid for problems one at a time. Every bid restarts the countdown. Win a problem and only you may solve it." },
  { icon: <Icon.Code size={18} />, title: "Coding", body: "Solve what you own. Submit as often as you like; wrong answers cost nothing. Ties break on total solve time." },
];

const RULES = [
  ["Same money for everyone", "Every finalist starts the auction with an identical balance. Money is not score."],
  ["Solving is all-or-nothing", "A solved problem earns its full score. There is no partial credit for hidden tests."],
  ["Hidden tests stay hidden", "You see the samples and the number of the failing test — never its contents, at any price. Hints are author-written text."],
  ["One seat, one session", "Signing in elsewhere ends your previous session. Your code and answers are saved on the server as you type."],
  ["Play fair", "Malpractice means disqualification. If something looks broken, raise your hand — do not work around it."],
  ["Nothing moves by itself", "Organisers advance the contest. Watch the timeline at the top for where you are and what is next."],
];

export default function WelcomePage() {
  const router = useRouter();
  const ready = () => { try { localStorage.setItem("welcomed", "1"); } catch { /* fine */ } router.push("/dashboard"); };
  return (
    <PageBody width="default" className="animate-fade-in">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col items-center text-center">
          <Mark size={52} />
          <h1 className="mt-4 text-[26px] font-semibold tracking-[-0.02em] sm:text-3xl">Welcome to Codolympics</h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted">First you prove yourself with puzzles and hacking. Then you bid for the problems you want to solve. Here is the whole day in one page.</p>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">How the day runs</h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3.5 rounded-box border border-line bg-card p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-box bg-navy text-green-bright">{s.icon}</span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold"><span className="mr-1.5 text-faint">{i + 1}.</span>{s.title}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">The rules that matter</h2>
          <ul className="divide-y divide-line rounded-box border border-line bg-card">
            {RULES.map(([t, b]) => (
              <li key={t} className="flex gap-3 px-4 py-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-tint text-green-dark"><Icon.Check size={12} strokeWidth={3} /></span>
                <div className="min-w-0"><div className="text-[13px] font-semibold">{t}</div><div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{b}</div></div>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button size="lg" icon={<Icon.ArrowRight size={16} />} onClick={ready}>I&apos;m ready</Button>
          <Link href="/dashboard" className="text-[12.5px] text-faint hover:text-muted">Skip for now</Link>
        </div>
      </div>
    </PageBody>
  );
}
