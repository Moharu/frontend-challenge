export function readEnv() {
  const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";
  if (!(baseURL.startsWith("/") && !baseURL.startsWith("//"))) {
    const url = new URL(baseURL);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new Error(
        "VITE_API_BASE_URL must be an HTTP(S) URL or a root-relative path",
      );
    }
  }
  const mocks = import.meta.env.VITE_ENABLE_MOCKS ?? "true";
  if (mocks !== "true" && mocks !== "false")
    throw new Error("VITE_ENABLE_MOCKS must be true or false");
  return {
    apiBaseURL: baseURL,
    enableMocks: mocks === "true",
  } as const;
}
