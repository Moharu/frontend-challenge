export function apiURL(baseURL: string): string {
  const url = new URL(baseURL, window.location.origin);
  if (url.search || url.hash)
    throw new Error("API base URL cannot include a query or fragment");
  return url.href.replace(/\/$/, "");
}
export function socketURL(baseURL: string): string {
  const url = new URL(apiURL(baseURL));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/socket.io/`;
  return url.href;
}
