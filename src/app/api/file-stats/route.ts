import { getInternalApiUrl, proxyJsonRequest } from "@/lib/api-proxy";

export async function POST(request: Request) {
  const incoming = await request.formData();
  const body = new FormData();

  for (const [key, value] of incoming.entries()) {
    if (typeof value === "string") {
      body.append(key, value);
      continue;
    }

    body.append(key, value, value.name);
  }

  return proxyJsonRequest(`${getInternalApiUrl()}/api/file-stats`, {
    method: "POST",
    body,
  });
}
