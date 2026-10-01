export async function calendarRequest(
  input: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch
): Promise<{ response: Response | null; error: string | null }> {
  try {
    const response = await fetcher(input, { ...init, signal: init.signal ?? AbortSignal.timeout(20_000) });
    if (response.ok) return { response, error: null };
    let error = "操作失败，请稍后重试";
    try {
      const payload = await response.clone().json();
      if (typeof payload.error === "string") error = payload.error;
    } catch {
      // Some hosting errors return HTML instead of an API response.
    }
    return { response, error };
  } catch {
    return { response: null, error: "网络连接失败，本次操作尚未保存，请重试" };
  }
}
