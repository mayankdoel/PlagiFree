import crypto from "node:crypto";

import { cleanedText, cosineSimilarity, selectSearchPhrases } from "../utils/text";
import type { SourceMatch } from "../types/report";
import { getCache, setCache } from "./cache";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-2.5-flash-lite,gemini-2.0-flash")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const LEGACY_GEMINI_SEARCH_MODEL = process.env.GEMINI_LEGACY_SEARCH_MODEL ?? "gemini-1.5-flash";
const GEMINI_RESEARCH_CACHE_VERSION = 3;

interface GeminiGroundingSource {
  url: string;
  title?: string;
}

interface GeminiResearchResponse {
  provider: "gemini-google-search" | "unavailable";
  matches: SourceMatch[];
  summary?: string;
  warning?: string;
  retryable?: boolean;
  searchQueries: string[];
  sourceLookups: number;
}

interface GeminiApiResult {
  ok: boolean;
  payload?: GeminiResponsePayload;
  warning?: string;
  retryable?: boolean;
  statusCode?: number;
  model?: string;
}

interface GeminiGroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: Array<{
    web?: {
      uri?: string;
      title?: string;
    };
  }>;
}

interface GeminiResponsePayload {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    groundingMetadata?: GeminiGroundingMetadata;
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
}

interface GroundedSearchAttempt {
  text: string;
  queries: string[];
  sources: GeminiGroundingSource[];
}

function trimPromptText(text: string, limit = 12000) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit)}...`;
}

function extractResponseText(payload: GeminiResponsePayload) {
  return payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim() ?? "";
}

function extractGroundingSources(payload: GeminiResponsePayload) {
  const uniqueSources = new Map<string, GeminiGroundingSource>();

  for (const chunk of payload.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
    const url = chunk.web?.uri?.trim();
    if (!url) {
      continue;
    }

    const existing = uniqueSources.get(url);
    if (existing) {
      continue;
    }

    uniqueSources.set(url, {
      url,
      title: chunk.web?.title?.trim() || undefined,
    });
  }

  return [...uniqueSources.values()];
}

function sourceTypeFromMetadata(url: string, title?: string) {
  const combined = `${url} ${title ?? ""}`.toLowerCase();
  const researchSignals = [
    "arxiv",
    "doi",
    "springer",
    "ieee",
    "acm",
    "sciencedirect",
    "researchgate",
    "semantic scholar",
    "semanticscholar",
    "journals",
    "conference",
    "thesis",
    "dissertation",
    "scholar.google",
    "ncbi",
    "pubmed",
    "mdpi",
    "tandfonline",
    "wiley",
  ];

  return researchSignals.some((signal) => combined.includes(signal)) ? "research-paper" : "web";
}

function bestMatchingPhrase(phrases: string[], sourceText: string, fallbackText: string) {
  const combinedText = `${sourceText} ${fallbackText}`.trim();
  let bestPhrase = phrases[0] ?? "";
  let bestScore = 0;

  for (const phrase of phrases) {
    const score = cosineSimilarity(phrase, combinedText);
    if (score > bestScore) {
      bestScore = score;
      bestPhrase = phrase;
    }
  }

  return bestPhrase;
}

function clampSimilarity(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

function sanitizeSnippet(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 320) : undefined;
}

function uniqueModels(primaryModel: string, fallbackModels: string[]) {
  return [...new Set([primaryModel, ...fallbackModels].filter(Boolean))];
}

function isRetryableGeminiStatus(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function summarizeGeminiError(status: number, body: string) {
  try {
    const parsed = JSON.parse(body) as {
      error?: {
        message?: string;
        status?: string;
      };
    };

    if (parsed.error?.message) {
      return `Gemini API request failed with status ${status}: ${parsed.error.message}`;
    }
  } catch {
    // Fall through to the raw body summary.
  }

  return `Gemini API request failed with status ${status}${body ? `: ${body.slice(0, 180)}` : "."}`;
}

async function callGeminiApi(
  payload: Record<string, unknown>,
  options?: {
    model?: string;
    timeoutMs?: number;
    fallbackModels?: string[];
    retries?: number;
  },
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      warning: "GEMINI_API_KEY is not configured.",
    } satisfies GeminiApiResult;
  }

  const modelQueue = uniqueModels(options?.model ?? GEMINI_MODEL, options?.fallbackModels ?? GEMINI_FALLBACK_MODELS);
  const retries = options?.retries ?? 2;
  let lastFailure: GeminiApiResult | null = null;

  for (const [modelIndex, model] of modelQueue.entries()) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 25000);

      try {
        const response = await fetch(
          `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          const retryable = isRetryableGeminiStatus(response.status);
          lastFailure = {
            ok: false,
            warning: summarizeGeminiError(response.status, body),
            retryable,
            statusCode: response.status,
            model,
          };

          if (retryable && attempt < retries) {
            await delay(700 * 2 ** attempt + modelIndex * 250);
            continue;
          }

          break;
        }

        return {
          ok: true,
          payload: (await response.json()) as GeminiResponsePayload,
          model,
        } satisfies GeminiApiResult;
      } catch (error) {
        lastFailure = {
          ok: false,
          warning: error instanceof Error ? `Gemini API request failed: ${error.message}` : "Gemini API request failed.",
          retryable: true,
          model,
        };

        if (attempt < retries) {
          await delay(700 * 2 ** attempt + modelIndex * 250);
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  return lastFailure ?? {
    ok: false,
    warning: "Gemini API request failed.",
    retryable: true,
  } satisfies GeminiApiResult;
}

function buildGroundedPrompt(text: string, phrases: string[]) {
  const excerpt = trimPromptText(text);
  const promptPhrases = phrases.slice(0, 10).map((phrase) => `- ${phrase}`).join("\n");

  return [
    "You are an academic plagiarism analyst.",
    "Use Google Search grounding to compare the document against public sources with priority on research papers, journals, conference papers, theses, books, preprints, and academic repositories.",
    "Find the strongest overlap candidates and explain whether they look like likely plagiarism or just topic similarity.",
    "Document excerpt:",
    `"""${excerpt}"""`,
    "High-signal phrases from the document:",
    promptPhrases || "- No strong phrases were extracted.",
    "Respond with:",
    "1. A short overall verdict.",
    "2. Up to 8 likely matching sources with title, URL, matched phrase or fragment, estimated overlap score (0-100), and a short evidence note.",
    "3. Focus on sources with the clearest wording overlap, especially academic sources.",
  ].join("\n");
}

function buildPhraseGroundedPrompt(phrase: string, text: string) {
  const excerpt = trimPromptText(text, 4500);

  return [
    "You are checking plagiarism against public web sources.",
    "Use Google Search grounding for this task.",
    `Search for exact or near-exact reuse of this phrase from the document: "${phrase}"`,
    "Prefer research papers, reports, theses, repositories, and documents that repeat the same wording.",
    "If you find candidate sources, summarize the strongest ones briefly.",
    "Document excerpt for context:",
    `"""${excerpt}"""`,
  ].join("\n");
}

function buildStructuringPrompt(options: {
  groundedText: string;
  sources: GeminiGroundingSource[];
  phrases: string[];
}) {
  const sourceList = options.sources
    .map((source, index) => `${index + 1}. ${source.title ?? "Untitled source"} || ${source.url}`)
    .join("\n");
  const phraseList = options.phrases.slice(0, 12).map((phrase) => `- ${phrase}`).join("\n");

  return [
    "Convert the grounded plagiarism analysis into JSON.",
    "Use only the source URLs listed below.",
    "Prefer research papers and academic sources when the title or URL indicates scholarly content.",
    "If the grounded analysis did not provide a clear matched phrase, pick the closest phrase from the supplied phrase list.",
    "Return no more than 8 matches.",
    "Allowed grounded sources:",
    sourceList || "No grounded sources were returned.",
    "Document phrases:",
    phraseList || "- No phrases supplied.",
    "Grounded analysis:",
    options.groundedText,
  ].join("\n");
}

async function runGroundedSearchAttempt(
  prompt: string,
  options?: {
    legacyRetrieval?: boolean;
  },
) {
  const result = await callGeminiApi(
    {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      tools: options?.legacyRetrieval
        ? [
            {
              google_search_retrieval: {
                dynamic_retrieval_config: {
                  mode: "MODE_DYNAMIC",
                  dynamic_threshold: 0,
                },
              },
            },
          ]
        : [{ google_search: {} }],
    },
    options?.legacyRetrieval
      ? {
          model: LEGACY_GEMINI_SEARCH_MODEL,
          fallbackModels: [],
        }
      : undefined,
  );

  if (!result.ok || !result.payload) {
    return {
      ok: false as const,
      warning: result.warning ?? "Gemini grounded search request failed.",
      retryable: result.retryable,
    };
  }

  return {
    ok: true as const,
    payload: result.payload,
    text: extractResponseText(result.payload),
    queries: result.payload.candidates?.[0]?.groundingMetadata?.webSearchQueries ?? [],
    sources: extractGroundingSources(result.payload),
  };
}

function buildStructuringSchema() {
  return {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "A concise plagiarism assessment based on grounded sources.",
      },
      warning: {
        type: ["string", "null"],
        description: "A limitation or warning if the evidence is weak, otherwise null.",
      },
      matches: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "One of the grounded source URLs.",
            },
            title: {
              type: ["string", "null"],
              description: "The source title if known.",
            },
            matchedText: {
              type: "string",
              description: "A phrase from the input document that best matches the source.",
            },
            similarity: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description: "Estimated overlap strength as an integer percentage.",
            },
            snippet: {
              type: ["string", "null"],
              description: "A short evidence note or snippet.",
            },
            sourceType: {
              type: "string",
              enum: ["research-paper", "web", "unknown"],
              description: "Whether the source looks like a research paper or a general web page.",
            },
          },
          required: ["url", "matchedText", "similarity", "sourceType"],
        },
      },
    },
    required: ["summary", "warning", "matches"],
  };
}

function normalizeStructuredMatches(options: {
  rawMatches: unknown;
  allowedSources: GeminiGroundingSource[];
  phrases: string[];
}) {
  const allowedSourceMap = new Map(options.allowedSources.map((source) => [source.url, source]));
  if (!Array.isArray(options.rawMatches)) {
    return [];
  }

  const normalizedMatches: SourceMatch[] = [];

  for (const rawMatch of options.rawMatches) {
    if (!rawMatch || typeof rawMatch !== "object") {
      continue;
    }

    const candidate = rawMatch as Record<string, unknown>;
    const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
    if (!url || !allowedSourceMap.has(url)) {
      continue;
    }

    const allowedSource = allowedSourceMap.get(url);
    const title = typeof candidate.title === "string" ? candidate.title.trim() : allowedSource?.title;
    const snippet = sanitizeSnippet(candidate.snippet);
    const matchedTextCandidate =
      typeof candidate.matchedText === "string" ? candidate.matchedText.replace(/\s+/g, " ").trim() : "";

    const matchedText =
      matchedTextCandidate ||
      bestMatchingPhrase(options.phrases, title ?? "", snippet ?? "") ||
      options.phrases[0] ||
      "Potential overlap";

    normalizedMatches.push({
      url,
      title: title || allowedSource?.title,
      matchedText,
      similarity: clampSimilarity(candidate.similarity),
      snippet,
      sourceType:
        candidate.sourceType === "research-paper" || candidate.sourceType === "web" || candidate.sourceType === "unknown"
          ? candidate.sourceType
          : sourceTypeFromMetadata(url, title),
    });
  }

  return normalizedMatches
    .sort((left, right) => right.similarity - left.similarity)
    .filter((match, index, matches) => matches.findIndex((item) => item.url === match.url) === index);
}

export async function searchResearchSources(text: string, phrases = selectSearchPhrases(text)) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      provider: "unavailable",
      matches: [],
      summary: undefined,
      warning: "GEMINI_API_KEY is not configured. Add it to your .env file to run Gemini plagiarism research.",
      searchQueries: [],
      sourceLookups: 0,
    } satisfies GeminiResearchResponse;
  }

  const cacheKey = `gemini:research:v${GEMINI_RESEARCH_CACHE_VERSION}:${crypto
    .createHash("sha256")
    .update(cleanedText(text))
    .digest("hex")}`;
  const cached = await getCache<GeminiResearchResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  const attemptWarnings: string[] = [];
  let retryableFailureSeen = false;
  const groundedAttempts: GroundedSearchAttempt[] = [];
  const phraseAttempts = phrases.slice(0, 6);

  for (const phrase of phraseAttempts) {
    let attempt = await runGroundedSearchAttempt(buildPhraseGroundedPrompt(phrase, text));
    if (
      attempt.ok &&
      !attempt.payload.promptFeedback?.blockReason &&
      attempt.sources.length === 0 &&
      attempt.queries.length === 0
    ) {
      attempt = await runGroundedSearchAttempt(buildPhraseGroundedPrompt(phrase, text), {
        legacyRetrieval: true,
      });
    }

    if (!attempt.ok) {
      if (attempt.warning) {
        attemptWarnings.push(attempt.warning);
      }
      retryableFailureSeen = retryableFailureSeen || Boolean(attempt.retryable);
      continue;
    }

    if (attempt.payload.promptFeedback?.blockReason) {
      attemptWarnings.push("Gemini blocked one of the phrase-level grounded searches.");
      continue;
    }

    if (attempt.text || attempt.sources.length || attempt.queries.length) {
      groundedAttempts.push({
        text: attempt.text,
        queries: attempt.queries,
        sources: attempt.sources,
      });
    }

    if (groundedAttempts.reduce((count, item) => count + item.sources.length, 0) >= 8) {
      break;
    }
  }

  if (groundedAttempts.length === 0) {
    let broadAttempt = await runGroundedSearchAttempt(buildGroundedPrompt(text, phrases));
    if (
      broadAttempt.ok &&
      !broadAttempt.payload.promptFeedback?.blockReason &&
      broadAttempt.sources.length === 0 &&
      broadAttempt.queries.length === 0
    ) {
      broadAttempt = await runGroundedSearchAttempt(buildGroundedPrompt(text, phrases), {
        legacyRetrieval: true,
      });
    }

    if (!broadAttempt.ok || !broadAttempt.payload) {
      const retryable = retryableFailureSeen || Boolean(broadAttempt.retryable);
      const failedResponse: GeminiResearchResponse = {
        provider: "unavailable",
        matches: [],
        summary: undefined,
        warning: broadAttempt.warning ?? attemptWarnings[0] ?? "Gemini research request failed.",
        retryable,
        searchQueries: [],
        sourceLookups: 0,
      };

      if (!retryable) {
        await setCache(cacheKey, failedResponse, 1800);
      }
      return failedResponse;
    }

    if (broadAttempt.payload.promptFeedback?.blockReason) {
      const blockedResponse: GeminiResearchResponse = {
        provider: "unavailable",
        matches: [],
        summary: undefined,
        warning: "Gemini blocked the plagiarism research prompt.",
        searchQueries: [],
        sourceLookups: 0,
      };

      await setCache(cacheKey, blockedResponse, 3600);
      return blockedResponse;
    }

    groundedAttempts.push({
      text: broadAttempt.text,
      queries: broadAttempt.queries,
      sources: broadAttempt.sources,
    });
  }

  const groundedText = groundedAttempts
    .map((attempt, index) => `Attempt ${index + 1}:\n${attempt.text}`)
    .filter(Boolean)
    .join("\n\n");
  const searchQueries = [...new Set(groundedAttempts.flatMap((attempt) => attempt.queries))];
  const groundedSourceMap = new Map<string, GeminiGroundingSource>();

  for (const attempt of groundedAttempts) {
    for (const source of attempt.sources) {
      if (!groundedSourceMap.has(source.url)) {
        groundedSourceMap.set(source.url, source);
      }
    }
  }

  const groundedSources = [...groundedSourceMap.values()];

  if (!groundedText && groundedSources.length === 0) {
    const failedResponse: GeminiResearchResponse = {
      provider: "unavailable",
      matches: [],
      summary: undefined,
      warning:
        attemptWarnings[0] ??
        "Gemini answered without grounded sources. The model may have handled the request from its own knowledge instead of performing Google Search.",
      retryable: retryableFailureSeen,
      searchQueries,
      sourceLookups: 0,
    };

    if (!failedResponse.retryable) {
      await setCache(cacheKey, failedResponse, 1800);
    }
    return failedResponse;
  }

  if (!groundedText || groundedSources.length === 0) {
    const noGroundingResponse: GeminiResearchResponse = {
      provider: "unavailable",
      matches: [],
      summary: groundedText || undefined,
      warning:
        attemptWarnings[0] ??
        "Gemini did not return grounded sources for this plagiarism scan. The model may not have found public search results for the extracted phrases.",
      retryable: retryableFailureSeen,
      searchQueries,
      sourceLookups: groundedSources.length,
    };

    if (!noGroundingResponse.retryable) {
      await setCache(cacheKey, noGroundingResponse, 3600);
    }
    return noGroundingResponse;
  }

  const structuringPayload = await callGeminiApi({
    contents: [
      {
        parts: [
          {
            text: buildStructuringPrompt({
              groundedText,
              sources: groundedSources,
              phrases,
            }),
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: buildStructuringSchema(),
      temperature: 0.2,
    },
  });

  let summary = groundedText;
  let warning: string | undefined;
  let matches: SourceMatch[] = [];

  if (structuringPayload.ok && structuringPayload.payload) {
    try {
      const structuredText = extractResponseText(structuringPayload.payload);
      const structured = JSON.parse(structuredText) as {
        summary?: string;
        warning?: string | null;
        matches?: unknown;
      };

      summary = typeof structured.summary === "string" && structured.summary.trim()
        ? structured.summary.trim()
        : groundedText;
      warning = typeof structured.warning === "string" && structured.warning.trim()
        ? structured.warning.trim()
        : undefined;
      matches = normalizeStructuredMatches({
        rawMatches: structured.matches,
        allowedSources: groundedSources,
        phrases,
      });
    } catch {
      warning = "Gemini returned grounded sources, but the structured plagiarism details could not be parsed cleanly.";
    }
  } else {
    warning =
      structuringPayload.warning ??
      "Gemini returned grounded sources, but the structured plagiarism details could not be generated.";
  }

  if (matches.length === 0) {
    matches = groundedSources.slice(0, 6).map((source) => ({
      url: source.url,
      title: source.title,
      matchedText: bestMatchingPhrase(phrases, source.title ?? "", groundedText) || "Potential overlap",
      similarity: 24,
      snippet: "Gemini surfaced this source during grounded academic search, but overlap strength was not fully structured.",
      sourceType: sourceTypeFromMetadata(source.url, source.title),
    }));
  }

  const finalResponse: GeminiResearchResponse = {
    provider: "gemini-google-search",
    matches,
    summary,
    warning: warning ?? attemptWarnings[0],
    searchQueries,
    sourceLookups: groundedSources.length,
  };

  await setCache(cacheKey, finalResponse, 21600);
  return finalResponse;
}
