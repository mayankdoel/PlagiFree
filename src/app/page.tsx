import { ArrowUpRight, ShieldCheck, UploadCloud, Zap } from "lucide-react";

import { CheckerForm } from "@/components/checker-form";

const featureCards = [
  {
    title: "Unlimited checks, zero friction",
    description:
      "Open the site and start checking immediately. No login walls, no email capture, and no fake free trials.",
    icon: Zap,
  },
  {
    title: "Paste text or upload documents",
    description:
      "Run plagiarism scans on pasted content as well as PDF, DOCX, and TXT files without bouncing between tools.",
    icon: UploadCloud,
  },
  {
    title: "Actionable source matching",
    description:
      "See match percentages, flagged phrases, highlighted content, and a downloadable report you can keep or share.",
    icon: ShieldCheck,
  },
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <section className="grid-fade mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 pb-16 pt-10 sm:px-8 lg:px-10">
        <div className="mb-16 flex items-center justify-between">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 shadow-soft">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent-mint" />
            Live plagiarism detection, no account required
          </div>
          <a
            href="#checker"
            className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-200 transition duration-200 hover:border-accent-cyan/50 hover:text-white sm:inline-flex"
          >
            Start checking
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        <div className="grid items-start gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16">
          <div className="space-y-8">
            <div className="space-y-6">
              <p className="text-sm uppercase tracking-[0.32em] text-accent-cyan/80">
                PlagiFree
              </p>
              <h1 className="max-w-4xl font-[var(--font-heading)] text-5xl font-bold leading-[0.95] text-white sm:text-6xl lg:text-7xl">
                Check Plagiarism Free
                <span className="block bg-gradient-to-r from-white via-accent-cyan to-accent-mint bg-clip-text text-transparent">
                  No Limits, No Login
                </span>
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                A polished, production-ready plagiarism checker for instant text and file analysis.
                Paste content, upload PDF or DOCX files, scan the web for matching phrases, and
                download a report in seconds.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {featureCards.map((card) => (
                <article
                  key={card.title}
                  className="glass-panel group p-5 transition duration-300 hover:-translate-y-1 hover:border-accent-cyan/30"
                >
                  <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-accent-cyan transition duration-200 group-hover:border-accent-cyan/40 group-hover:text-white">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <h2 className="mb-2 text-lg font-semibold text-white">{card.title}</h2>
                  <p className="text-sm leading-6 text-slate-400">{card.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div
            id="checker"
            className="relative rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-1 shadow-glow"
          >
            <div className="absolute -left-10 top-8 hidden h-24 w-24 rounded-full bg-accent-cyan/20 blur-3xl lg:block" />
            <div className="absolute -right-10 bottom-8 hidden h-24 w-24 rounded-full bg-accent-mint/20 blur-3xl lg:block" />
            <CheckerForm />
          </div>
        </div>
      </section>
    </main>
  );
}

