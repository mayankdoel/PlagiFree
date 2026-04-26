import * as cheerio from "cheerio";

import { getCache, setCache } from "./cache";

const endpoint = process.env.BING_SEARCH_ENDPOINT ?? "https://api.bing.microsoft.com/v7.0/search";
const bingHtmlEndpoint = "https://www.bing.com/search";

export interface SearchResult {
  name?: string;
  url: string;
  snippet?: string;
}

interface BingResponse {
  webPages?: {
    value?: SearchResult[];
  };
}

export interface SearchResponse {
  provider: "bing-api" | "bing-web" | "unavailable";
  results: SearchResult[];
  warning?: string;
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "PlagiFreeBot/1.0 (+https://plagifree.local)",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return "";
    }

    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractPageText(url: string) {
  const cacheKey = `page:${url}`;
  const cached = await getCache<string>(cacheKey);
  if (cached) {
    return cached;
  }

  const html = await fetchHtml(url);
  if (!html) {
    return "";
  }

  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const trimmed = text.slice(0, 20000);
  await setCache(cacheKey, trimmed, 21600);
  return trimmed;
}

async function searchViaBingApi(phrase: string) {
  const apiKey = process.env.BING_API_KEY;
  if (!apiKey) {
    return null;
  }

  const searchUrl = new URL(endpoint);
  searchUrl.searchParams.set("q", `"${phrase}"`);
  searchUrl.searchParams.set("count", "5");
  searchUrl.searchParams.set("responseFilter", "Webpages");
  searchUrl.searchParams.set("textDecorations", "false");
  searchUrl.searchParams.set("textFormat", "Raw");

  const response = await fetch(searchUrl, {
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
    },
  });

  if (!response.ok) {
    return {
      provider: "bing-api" as const,
      results: [],
      warning: `Bing API request failed with status ${response.status}.`,
    };
  }

  const payload = (await response.json()) as BingResponse;
  return {
    provider: "bing-api" as const,
    results: payload.webPages?.value ?? [],
  };
}

async function searchViaBingWeb(phrase: string): Promise<SearchResponse> {
  const searchUrl = new URL(bingHtmlEndpoint);
  searchUrl.searchParams.set("q", `"${phrase}"`);
  searchUrl.searchParams.set("count", "5");

  const html = await fetchHtml(searchUrl.toString());
  if (!html) {
    return {
      provider: "unavailable",
      results: [],
      warning: "Search provider could not be reached for this phrase.",
    };
  }

  const $ = cheerio.load(html);
  const results: SearchResult[] = [];

  $("li.b_algo").each((_index, element) => {
    if (results.length >= 5) {
      return false;
    }

    const anchor = $(element).find("h2 a").first();
    const url = anchor.attr("href");

    if (!url) {
      return;
    }

    const title = anchor.text().trim();
    const snippet = $(element).find(".b_caption p").first().text().trim();

    results.push({
      url,
      name: title || undefined,
      snippet: snippet || undefined,
    });
  });

  return {
    provider: results.length ? "bing-web" : "unavailable",
    results,
    warning: results.length ? undefined : "No results were returned from the web search fallback.",
  };
}

export async function searchPhrase(phrase: string) {
  const cacheKey = `phrase:${phrase}`;
  const cached = await getCache<SearchResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const apiResponse = await searchViaBingApi(phrase);
    if (apiResponse?.results.length) {
      await setCache(cacheKey, apiResponse, 86400);
      return apiResponse;
    }

    const webResponse = await searchViaBingWeb(phrase);
    const finalResponse = apiResponse?.provider === "bing-api"
      ? {
          provider: webResponse.provider,
          results: webResponse.results,
          warning: apiResponse.warning ?? webResponse.warning,
        }
      : webResponse;

    await setCache(cacheKey, finalResponse, 86400);
    return finalResponse;
  } catch {
    const fallbackResponse: SearchResponse = {
      provider: "unavailable",
      results: [],
      warning: "Search lookups failed while processing this phrase.",
    };

    await setCache(cacheKey, fallbackResponse, 3600);
    return fallbackResponse;
  }
}
