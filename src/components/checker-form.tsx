"use client";

import { useState } from "react";

export function CheckerForm() {
  const [text, setText] = useState("");

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <label className="mb-3 block text-sm font-medium text-slate-200" htmlFor="sourceText">
        Paste your content
      </label>
      <textarea
        id="sourceText"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste text to scan for plagiarism"
        className="min-h-[280px] w-full rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-4 text-base text-slate-100 outline-none"
      />

      <button
        type="button"
        className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950"
      >
        Check Now
      </button>
    </div>
  );
}
