"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, LoaderCircle, Sparkles, Upload } from "lucide-react";

function acceptedFileType(fileName: string) {
  return /\.(txt|pdf|docx)$/i.test(fileName);
}

interface InputStats {
  words: number;
  characters: number;
}

interface FileStats extends InputStats {
  filename: string;
}

export function CheckerForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileStats, setFileStats] = useState<FileStats | null>(null);
  const [isLoadingFileStats, setIsLoadingFileStats] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const uploadRequestId = useRef(0);
  const queuedSubmitRef = useRef(false);

  const textStats = useMemo<InputStats>(() => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return {
      words,
      characters: text.length,
    };
  }, [text]);

  const activeStats = file && fileStats ? fileStats : textStats;
  const activeSourceLabel = file ? "From uploaded file" : "From pasted text";

  const runCheck = useCallback(() => {
    const formData = new FormData();

    if (file) {
      formData.append("file", file);
    } else if (text.trim()) {
      formData.append("text", text);
    }

    startTransition(() => {
      void (async () => {
        try {
          setIsSubmitting(true);
          const response = await fetch("/api/check", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error ?? "Unable to complete plagiarism check.");
          }

          const payload = (await response.json()) as { id: string };
          router.push(`/results/${payload.id}`);
        } catch (submissionError) {
          setError(
            submissionError instanceof Error
              ? submissionError.message
              : "Something went wrong while checking the text.",
          );
        } finally {
          setIsSubmitting(false);
        }
      })();
    });
  }, [file, router, text]);

  useEffect(() => {
    if (!file || !acceptedFileType(file.name)) {
      return;
    }

    const currentRequestId = uploadRequestId.current + 1;
    uploadRequestId.current = currentRequestId;
    setIsLoadingFileStats(true);

    const formData = new FormData();
    formData.append("file", file);

    void (async () => {
      try {
        const response = await fetch("/api/file-stats", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Unable to read the uploaded file.");
        }

        const payload = (await response.json()) as FileStats;
        if (uploadRequestId.current !== currentRequestId) {
          return;
        }

        setFileStats({
          filename: payload.filename,
          words: payload.words,
          characters: payload.characters,
        });
      } catch (fileError) {
        if (uploadRequestId.current !== currentRequestId) {
          return;
        }

        queuedSubmitRef.current = false;
        setFile(null);
        setFileStats(null);
        setError(
          fileError instanceof Error ? fileError.message : "Unable to read the uploaded file.",
        );
      } finally {
        if (uploadRequestId.current === currentRequestId) {
          setIsLoadingFileStats(false);
        }
      }
    })();
  }, [file]);

  useEffect(() => {
    if (!isLoadingFileStats && queuedSubmitRef.current) {
      queuedSubmitRef.current = false;
      runCheck();
    }
  }, [isLoadingFileStats, runCheck]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;

    if (nextFile && !acceptedFileType(nextFile.name)) {
      setError("Only PDF, DOCX, and TXT files are supported for uploads.");
      setFile(null);
      return;
    }

    setError(null);
    setFile(nextFile);
    setFileStats(null);
  };

  const handleSubmit = async () => {
    if (!text.trim() && !file) {
      setError("Paste text or upload a supported file to start checking.");
      return;
    }

    setError(null);

    if (isLoadingFileStats) {
      queuedSubmitRef.current = true;
      return;
    }

    runCheck();
  };

  return (
    <div className="glass-panel relative overflow-hidden p-6 sm:p-8">
      <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-accent-cyan/60 to-transparent" />
      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
          <Sparkles className="h-4 w-4 text-accent-mint" />
          No signup, no limits
        </span>
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
        placeholder="Paste essays, reports, blogs, assignments, research notes, or entire documents here. There is no word-limit gate in the UI."
        className="min-h-[280px] w-full rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-4 text-base text-slate-100 outline-none transition duration-200 placeholder:text-slate-500 hover:border-accent-cyan/40 focus:border-accent-cyan/70 focus:ring-2 focus:ring-accent-cyan/20"
      />

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <label
            className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 transition duration-200 hover:border-accent-cyan/50 hover:bg-white/[0.06]"
            htmlFor="fileUpload"
          >
            <span className="rounded-xl border border-white/10 bg-base-900 p-2 transition duration-200 group-hover:border-accent-cyan/50 group-hover:text-accent-cyan">
              <Upload className="h-4 w-4" />
            </span>
            <span>{file ? file.name : "Upload a .txt, .pdf, or .docx file"}</span>
          </label>
          <input id="fileUpload" type="file" accept=".txt,.pdf,.docx" className="hidden" onChange={handleFileChange} />
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 px-3 py-1">
              {isLoadingFileStats ? "Counting words..." : `${activeStats.words.toLocaleString()} words`}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1">
              {isLoadingFileStats
                ? "Counting characters..."
                : `${activeStats.characters.toLocaleString()} characters`}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1 text-slate-500">
              {activeSourceLabel}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || isSubmitting}
          className="group inline-flex min-w-[210px] items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-accent-cyan via-sky-400 to-accent-mint px-6 py-4 text-base font-semibold text-slate-950 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(98,230,255,0.28)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending || isLoadingFileStats || isSubmitting ? (
            <>
              <LoaderCircle className="h-5 w-5 animate-spin" />
              {isLoadingFileStats ? "Preparing file..." : "Checking sources..."}
            </>
          ) : (
            <>
              Check Now
              <ArrowRight className="h-5 w-5 transition duration-200 group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>

      {isSubmitting && !error ? (
        <p className="mt-4 text-sm text-accent-cyan/90">
          Running plagiarism scan and collecting source matches...
        </p>
      ) : null}

      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
