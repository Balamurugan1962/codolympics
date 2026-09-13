import { Mark } from "@/components/logo";

/**
 * Sign-in and registration: a two-panel page. The left states what this is
 * and what to expect; the right does the one job. Below `lg` the panel
 * collapses and only the form remains.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="relative hidden w-[42%] max-w-lg flex-col justify-between overflow-hidden bg-navy px-10 py-10 text-white lg:flex">
        <div className="relative flex items-center gap-2.5">
          <Mark size={28} />
          <span className="text-[17px] font-bold tracking-tight">Cod<span className="text-brand-bright">olympics</span></span>
        </div>

        <div className="relative">
          <h2 className="max-w-sm text-[21px] font-semibold leading-[1.25] tracking-[-0.015em]">
            Prove yourself, then <span className="text-brand-bright">bid</span> for the problems you want to solve.
          </h2>
          <ul className="mt-6 space-y-4 text-[12.5px] leading-relaxed text-white/65">
            {[
              ["Phase 1", "Logical puzzles, then hacking. Your score decides who reaches the auction."],
              ["Phase 2", "Problems are auctioned one at a time. One owner each — nobody else may attempt yours."],
              ["Scoring", "Solving is all-or-nothing. Wrong submissions cost nothing; ties break on solve time."],
            ].map(([k, v]) => (
              <li key={k} className="flex gap-3">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand-bright" />
                <span><span className="font-semibold text-white">{k}.</span> {v}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12px] text-white/40">Runs on the hall network. Your work is saved on the server as you type.</p>
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="flex items-center gap-2.5 px-6 py-5 lg:hidden">
          <Mark size={24} />
          <span className="text-[15px] font-bold tracking-tight text-ink">Cod<span className="text-brand-deep">olympics</span></span>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-8 sm:py-12">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
