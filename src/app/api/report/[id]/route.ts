import { getInternalApiUrl, proxyBinaryRequest } from "@/lib/api-proxy";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  return proxyBinaryRequest(`${getInternalApiUrl()}/api/report/${id}`, {
    method: "GET",
  });
}
