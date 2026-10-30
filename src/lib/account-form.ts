import { useEffect, useState } from "react";
// "Nome ENS" in the frame: a `.eth` selector next to the name. The value is
// the full name (`ada.eth`); an empty name means no ENS name.
export const ensLocal = (full: string) => full.replace(/\.eth$/, "");
export const ensFull = (local: string) =>
  local.trim() ? `${local.trim().replace(/\.eth$/, "")}.eth` : "";
// Moves focus to the first invalid field (ids share a prefix) once the
// errors have rendered: call the returned function after setting them.
export function useFocusFirstError(prefix: string) {
  const [request, setRequest] = useState(0);
  useEffect(() => {
    if (!request) return;
    document
      .querySelector<HTMLElement>(`[id^="${prefix}"][aria-invalid="true"]`)
      ?.focus();
  }, [request, prefix]);
  return () => setRequest((n) => n + 1);
}
