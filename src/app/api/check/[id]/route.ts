import { getInternalApiUrl, proxyJsonRequest } from "@/lib/api-proxy";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  return proxyJsonRequest(`${getInternalApiUrl()}/api/check/${id}`, {
    method: "GET",
  });
}
