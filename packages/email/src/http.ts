export async function readJsonResponse(response: Pick<Response, "status" | "json">): Promise<unknown> {
  if (response.status === 204) return null;
  return response.json();
}
