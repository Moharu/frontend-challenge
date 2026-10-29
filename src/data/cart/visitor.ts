// Only the opaque visitor token is kept on the client; the cart itself lives
// on the (simulated) server. Storage may be unavailable, so memory backs it.
const key = "kurio.visitor.v1";
let memory: string | null = null;
export function visitorToken(): string | null {
  try {
    return localStorage.getItem(key) ?? memory;
  } catch {
    return memory;
  }
}
export function setVisitorToken(token: string | null) {
  memory = token;
  try {
    if (token) localStorage.setItem(key, token);
    else localStorage.removeItem(key);
  } catch {
    // Memory fallback already holds the value.
  }
}
