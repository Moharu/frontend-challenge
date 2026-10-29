import { useEffect, useState } from "react";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { subscribeIdentity, verifySession } from "@/data/session/identity";
import { SessionUnconfirmed } from "@/lib/route-guards";
// Error component of private routes. For an unconfirmed session it offers a
// retry that repeats the verification and re-runs the route guard, which then
// continues, or sends to the login, according to the result. The automatic
// retries on focus/online re-run the guard the same way.
export function SessionCheckError({ error }: ErrorComponentProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const unconfirmed = error instanceof SessionUnconfirmed;
  useEffect(
    () =>
      unconfirmed
        ? subscribeIdentity(() => void router.invalidate())
        : undefined,
    [router, unconfirmed],
  );
  if (!unconfirmed) throw error;
  async function retry() {
    if (pending) return;
    setPending(true);
    try {
      await verifySession();
      await router.invalidate();
    } finally {
      setPending(false);
    }
  }
  return (
    <main id="main" className="query-error" role="alert">
      <h1>Não foi possível confirmar sua sessão</h1>
      <p>
        Verifique sua conexão e tente novamente. Sua sessão não foi encerrada.
      </p>
      <button
        className="button button-primary"
        aria-disabled={pending}
        onClick={() => void retry()}
      >
        {pending ? "Verificando…" : "Tentar novamente"}
      </button>
    </main>
  );
}
