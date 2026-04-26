"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { FileText, Upload } from "lucide-react";

function acceptedFileType(fileName: string) {
  return /\.(txt|pdf|docx)$/i.test(fileName);
}

export function CheckerForm() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputStats = useMemo(() => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return {
      words,
      characters: text.length,
    };
  }, [text]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;

    if (nextFile && !acceptedFileType(nextFile.name)) {
      setError("Only PDF, DOCX, and TXT files are supported for uploads.");
      setFile(null);
      return;
    }

    setError(null);
    setFile(nextFile);
  };

  return (
    <div className="glass-panel p-6 sm:p-8">
      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
          <FileText className="h-4 w-4 text-accent-cyan" />
          Supports TXT, PDF, DOCX
        </span>
      </div>

      <label className="mb-3 block text-sm font-medium text-slate-200" htmlFor="sourceText">
        Paste your content
      </label>
      <textarea
        id="sourceText"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste essays, reports, blogs, assignments, research notes, or entire documents here."
        className="min-h-[280px] w-full rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-4 text-base text-slate-100 outline-none placeholder:text-slate-500"
      />

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <label
            className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-slate-300"
            htmlFor="fileUpload"
          >
            <span className="rounded-xl border border-white/10 bg-base-900 p-2">
              <Upload className="h-4 w-4" />
            </span>
            <span>{file ? file.name : "Upload a .txt, .pdf, or .docx file"}</span>
          </label>
          <input id="fileUpload" type="file" accept=".txt,.pdf,.docx" className="hidden" onChange={handleFileChange} />
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 px-3 py-1">
              {inputStats.words.toLocaleString()} words
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1">
              {inputStats.characters.toLocaleString()} characters
            </span>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex min-w-[210px] items-center justify-center rounded-2xl bg-gradient-to-r from-accent-cyan via-sky-400 to-accent-mint px-6 py-4 text-base font-semibold text-slate-950 shadow-soft"
        >
          Check Now
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
