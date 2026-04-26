import { CheckerForm } from "@/components/checker-form";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-12">
      <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div className="space-y-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">PlagiFree</p>
          <h1 className="text-5xl font-bold leading-tight text-white sm:text-6xl">
            Check Plagiarism Free
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-300">
            A no-login plagiarism checker for instant text and file analysis.
          </p>
        </div>

        <CheckerForm />
      </section>
    </main>
  );
}
