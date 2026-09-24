"use client";

/**
 * The contest-facing side of a problem: what participants read and what it
 * costs. The judge never sees any of this. Shared by the new-problem wizard
 * and the problem page so the two can never drift apart.
 */
import { Icon } from "../icons";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ChoiceCards } from "../ui/choice";
import { FormGrid } from "../ui/field";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { MarkdownEditor } from "../ui/markdown-editor";
import { difficultyLabel, difficultyVariant } from "@/lib/difficulty";

export type QuestionDetails = {
  title: string; topic: string; difficulty: "very_easy" | "easy" | "medium" | "hard"; score: number; base_price: number; auction_order: number;
  statement_md: string; sample_count: number; hints: { price: number; body_md: string }[];
};

export const EMPTY_DETAILS: QuestionDetails = { title: "", topic: "", difficulty: "medium", score: 100, base_price: 100, auction_order: 1, statement_md: "", sample_count: 1, hints: [] };

export function detailsIssues(d: QuestionDetails, testcases: number | null): string[] {
  const out: string[] = [];
  if (!d.title.trim()) out.push("Give the problem a title.");
  if (!d.topic.trim()) out.push("Give the topic. It is all a bidder is told about the problem.");
  if (!d.statement_md.trim()) out.push("Write the statement. Participants would see an empty problem.");
  if (d.score < 0 || !Number.isInteger(d.score)) out.push("Score must be a whole number, zero or more.");
  if (d.base_price < 0 || !Number.isInteger(d.base_price)) out.push("Base price must be a whole number, zero or more.");
  if (d.auction_order < 0 || !Number.isInteger(d.auction_order)) out.push("Auction order must be a whole number.");
  if (d.sample_count < 0 || d.sample_count > 20) out.push("Samples: between 0 and 20.");
  if (testcases !== null && d.sample_count > testcases) out.push(`Only ${testcases} testcase${testcases === 1 ? "" : "s"} in the package. You cannot show ${d.sample_count} as samples.`);
  if (testcases !== null && testcases > 0 && d.sample_count >= testcases) out.push("Every testcase would be a sample; nothing would be hidden.");
  return out;
}

export function hintIssues(hints: QuestionDetails["hints"]): string[] {
  return hints.flatMap((h, i) => [
    ...(!h.body_md.trim() ? [`Hint ${i + 1} has no text.`] : []),
    ...(h.price < 0 || !Number.isInteger(h.price) ? [`Hint ${i + 1}: price must be a whole number.`] : []),
  ]);
}

export function DifficultyBadge({ d }: { d: string }) {
  return <Badge variant={difficultyVariant(d)}>{difficultyLabel(d)}</Badge>;
}

export function QuestionBasicsFields({ d, onChange, testcases }: { d: QuestionDetails; onChange: (d: QuestionDetails) => void; testcases: number | null }) {
  const set = <K extends keyof QuestionDetails>(k: K, v: QuestionDetails[K]) => onChange({ ...d, [k]: v });
  return (
    <div className="space-y-5">
      <Field label="Title" help="For you and for whoever wins it. Bidders never see this.">
        <Input value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Shortest Round Trip" maxLength={200} autoFocus />
      </Field>
      <Field
        label="Topic"
        hint="what the room bids on"
        help="With the tier, the price and the points, this is everything a bidder is told. Say enough to bid on and not enough to solve: “Graphs, shortest paths”, not “Dijkstra on a 2D grid with teleports”."
      >
        <Input value={d.topic} onChange={(e) => set("topic", e.target.value)} placeholder="e.g. Graphs, shortest paths" maxLength={80} />
      </Field>
      <Field label="Tier" help="Shown to bidders with the topic. Set the price and points to match.">
        <ChoiceCards
          value={d.difficulty}
          onChange={(v) => set("difficulty", v)}
          cols={4}
          size="sm"
          options={[
            { value: "very_easy", label: "Very easy", description: "Nearly everyone solves it. The cheapest, the lowest score." },
            { value: "easy", label: "Easy", description: "Most finalists solve it. Cheap, low score." },
            { value: "medium", label: "Medium", description: "A real problem. The middle of the auction." },
            { value: "hard", label: "Hard", description: "Few will solve it. Expensive, high score." },
          ]}
        />
      </Field>
      <FormGrid cols={3}>
        <Field label="Points" help="Paid to the owner when they solve it. All or nothing, and shown to bidders.">
          <Input type="number" min={0} step={1} value={d.score} onChange={(e) => set("score", Number(e.target.value))} />
        </Field>
        <Field label="Base price" help="Where bidding opens, in coins. Coins are not points.">
          <Input type="number" min={0} step={1} value={d.base_price} onChange={(e) => set("base_price", Number(e.target.value))} />
        </Field>
        <Field label="Auction order" help="Lower goes on the block first. Published in advance.">
          <Input type="number" min={0} step={1} value={d.auction_order} onChange={(e) => set("auction_order", Number(e.target.value))} />
        </Field>
      </FormGrid>
      <Field label="Statement" help="Input and output format, constraints, and at least one worked example belong here.">
        <MarkdownEditor value={d.statement_md} onChange={(v) => set("statement_md", v)} rows={14} placeholder={"Read two integers `a` and `b` from standard input and print `a + b`.\n\n### Input\n…\n\n### Output\n…"} />
      </Field>
      <Field label="Samples" help={testcases !== null ? `The first ${d.sample_count || 0} of the package's ${testcases} testcases are shown to the owner, read straight from the package so a sample can never disagree with what is judged. The rest stay hidden.` : "The first K testcases of the package are shown to the owner as samples; the rest stay hidden."}>
        <div className="flex items-center gap-2">
          <Input type="number" min={0} max={20} step={1} className="w-24" value={d.sample_count} onChange={(e) => set("sample_count", Number(e.target.value))} />
          <span className="text-[12px] text-muted-foreground">testcases shown as samples</span>
        </div>
      </Field>
    </div>
  );
}

export function HintsEditor({ hints, onChange }: { hints: QuestionDetails["hints"]; onChange: (h: QuestionDetails["hints"]) => void }) {
  const update = (i: number, patch: Partial<QuestionDetails["hints"][number]>) => onChange(hints.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= hints.length) return; const n = [...hints]; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return (
    <div className="space-y-3">
      {hints.length === 0 ? (
        <div className="rounded-box border border-dashed border-line-2 px-4 py-6 text-center">
          <p className="text-[13px] font-medium">No hints.</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Someone with money and no idea will have nothing to buy. Hints are optional, but a problem without them cannot be nudged.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => onChange([{ price: 50, body_md: "" }])}><Icon.Plus size={14} /> Add the first hint</Button>
        </div>
      ) : (
        <ol className="space-y-3">
          {hints.map((h, i) => (
            <li key={i} className="rounded-box border border-line bg-card">
              <div className="flex items-center gap-3 border-b border-line bg-muted/60 px-3.5 py-2">
                <span className="text-[12px] font-semibold text-muted-foreground">Hint {i + 1}</span>
                <span className="text-[11.5px] text-faint">unlocks after hint {i}{i === 0 ? ". The first one anyone can buy" : ""}</span>
                <div className="ml-auto flex items-center gap-1">
                  <Button size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                  <Button size="sm" variant="ghost" aria-label="Move down" disabled={i === hints.length - 1} onClick={() => move(i, 1)}>↓</Button>
                  <Button size="sm" variant="ghost" aria-label={`Remove hint ${i + 1}`} onClick={() => onChange(hints.filter((_, j) => j !== i))}><Icon.Trash size={15} /></Button>
                </div>
              </div>
              <div className="grid gap-3 p-3.5 sm:grid-cols-[140px_minmax(0,1fr)]">
                <Field label="Price" help="Deducted from the buyer's balance.">
                  <Input type="number" min={0} step={1} value={h.price} onChange={(e) => update(i, { price: Number(e.target.value) })} />
                </Field>
                <Field label="Text" hint="Markdown">
                  <Textarea rows={3} value={h.body_md} placeholder="Think about what happens when n = 1." onChange={(e) => update(i, { body_md: e.target.value })} />
                </Field>
              </div>
            </li>
          ))}
        </ol>
      )}
      {hints.length > 0 && hints.length < 20 && (
        <Button size="sm" variant="outline" onClick={() => onChange([...hints, { price: hints[hints.length - 1]?.price ?? 50, body_md: "" }])}><Icon.Plus size={14} /> Add another hint</Button>
      )}
    </div>
  );
}
