import { ResultsClient } from "@/components/results-client";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
      <div className="mb-10">
        <p className="text-sm uppercase tracking-[0.3em] text-accent-cyan/80">PlagiFree Report</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-white sm:text-5xl">
          Similarity analysis, highlighted instantly
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-300">
          Review flagged phrases, inspect matching sources, and export a clean PDF report without
          creating an account.
        </p>
      </div>

      <ResultsClient reportId={id} />
    </main>
  );
}

