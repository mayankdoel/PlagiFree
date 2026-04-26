import { ArrowUpRight } from "lucide-react";

import { CheckerForm } from "@/components/checker-form";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-10 sm:px-8">
      <div className="mb-16 flex items-center justify-between">
        <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 shadow-soft">
          <span className="h-2.5 w-2.5 rounded-full bg-accent-mint" />
          Instant plagiarism checks with no account
        </div>
        <a
          href="#checker"
          className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-200 sm:inline-flex"
        >
          Start checking
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>

      <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div className="space-y-6">
          <p className="text-sm uppercase tracking-[0.3em] text-accent-cyan/80">PlagiFree</p>
          <h1 className="max-w-4xl text-5xl font-bold leading-[1] text-white sm:text-6xl lg:text-7xl">
            Check Plagiarism Free
            <span className="mt-2 block bg-gradient-to-r from-white via-accent-cyan to-accent-mint bg-clip-text text-transparent">
              No Limits, No Login
            </span>
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
            Paste essays, upload files, scan the web for matching phrases, and review results
            instantly.
          </p>
        </div>

        <div id="checker" className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-1 shadow-glow">
          <CheckerForm />
        </div>
      </section>
    </main>
  );
}
