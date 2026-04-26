function copyProxyHeaders(response: Response) {
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  const contentDisposition = response.headers.get("content-disposition");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (contentDisposition) {
    headers.set("content-disposition", contentDisposition);
  }

  return headers;
}

export function getInternalApiUrl() {
  return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
}

export async function proxyJsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  });

  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: copyProxyHeaders(response),
  });
}

export async function proxyBinaryRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  });

  const body = await response.arrayBuffer();

  return new Response(body, {
    status: response.status,
    headers: copyProxyHeaders(response),
  });
}
