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

export async function searchPhrase(phrase: string) {
  const apiKey = process.env.BING_API_KEY;
  if (!apiKey) {
    return [] as BingSearchResult[];
  }

  const searchUrl = new URL(endpoint);
  searchUrl.searchParams.set("q", `"${phrase}"`);
  searchUrl.searchParams.set("count", "5");
  searchUrl.searchParams.set("responseFilter", "Webpages");

  const response = await fetch(searchUrl, {
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
    },
  });

  if (!response.ok) {
    return [] as BingSearchResult[];
  }

  const payload = (await response.json()) as BingResponse;
  return payload.webPages?.value ?? [];
}
