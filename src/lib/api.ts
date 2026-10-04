export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  command: string,
  data: Record<string, unknown> = {},
  write = false,
): Promise<T> {
  const params = new URLSearchParams({ command });
  for (const [k, v] of Object.entries(data))
    if (v !== undefined) params.set(k, String(v));
  const response = await fetch(
    write ? "/api" : `/api?${params}`,
    write
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, ...data }),
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        }
      : { cache: "no-store", signal: AbortSignal.timeout(15000) },
  );
  const json = await response.json();
  if (!response.ok)
    throw new ApiError(
      json.error || "Le service ne répond pas.",
      response.status,
    );
  return json;
}
