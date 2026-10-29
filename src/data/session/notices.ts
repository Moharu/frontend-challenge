// One polite announcement channel for session and cart changes (login, logout,
// expiry, cart merge, lost visitor cart), rendered by <Notices /> in the layout.
type Listener = (message: string) => void;
const listeners = new Set<Listener>();
export function notify(message: string) {
  listeners.forEach((listener) => listener(message));
}
export function subscribeNotices(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
