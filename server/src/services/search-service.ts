import * as cheerio from "cheerio";

import { getCache, setCache } from "./cache";

const endpoint = process.env.BING_SEARCH_ENDPOINT ?? "https://api.bing.microsoft.com/v7.0/search";

interface BingSearchResult {
  name?: string;
  url: string;
  snippet?: string;
}

interface BingResponse {
  webPages?: {
    value?: BingSearchResult[];
  };
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

export async function searchPhrase(phrase: string) {
  const cacheKey = `phrase:${phrase}`;
  const cached = await getCache<BingSearchResult[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const apiKey = process.env.BING_API_KEY;
  if (!apiKey) {
    return [];
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
    return [];
  }

  const payload = (await response.json()) as BingResponse;
  const results = payload.webPages?.value ?? [];
  await setCache(cacheKey, results, 86400);
  return results;
}
