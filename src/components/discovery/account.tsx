import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  onSessionExpired,
  signOut,
  useIdentity,
} from "@/data/session/identity";
import { subscribeNotices } from "@/data/session/notices";
import { authLink } from "@/lib/redirect";
import { useReturnTarget } from "@/lib/return-target";
import type { Session } from "@/contracts/session";
import { asset } from "./assets";
const displayName = (session: Session) =>
  session.user.displayName ?? session.user.username;
// Header account slot. While a stored session is verified it stays neutral,
// so an authenticated user never sees "Entrar" flash.
export function AccountArea() {
  const identity = useIdentity();
  const target = useReturnTarget();
  if (identity.status === "checking")
    return (
      <span
        className="account-pending inline-block w-[96px] h-[37px]"
        role="status"
      >
        <span className="sr-only">Verificando sua sessão</span>
      </span>
    );
  if (!identity.session)
    return (
      <Link className="button button-primary" {...authLink("login", target)}>
        <img src={asset("home-Logout.svg")} alt="" />
        Entrar
      </Link>
    );
  return <AccountMenu session={identity.session} />;
}
// Disclosure menu: Escape and outside clicks close it, returning focus.
function AccountMenu({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      ref={wrapper}
      className="account-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <button
        ref={toggle}
        className="account-toggle flex items-center gap-[6px] min-h-[37px] py-[0] px-[12px] font-bold text-[color:var(--accent)]"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="sr-only">Conta de </span>
        {displayName(session)}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul
          id="account-menu"
          className="account-panel absolute z-[45] min-w-[180px] p-[8px] m-[0] list-none bg-[color:var(--surface)]"
        >
          <li>
            <Link to="/account/profile" onClick={() => setOpen(false)}>
              Meu perfil
            </Link>
          </li>
          <li>
            <Link to="/account/wallets" onClick={() => setOpen(false)}>
              Carteiras
            </Link>
          </li>
          <li>
            <Link to="/account/favorites" onClick={() => setOpen(false)}>
              Lista de interesse
            </Link>
          </li>
          <li>
            <button
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              Sair
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
// Mobile "Minha conta": login when anonymous, an account sheet when signed in.
export function MobileAccount() {
  const identity = useIdentity();
  const target = useReturnTarget();
  const icon = <img src={asset("mobile-home-User.svg")} alt="" />;
  if (!identity.session)
    return (
      <Link
        {...authLink("login", target)}
        aria-label={
          identity.status === "checking"
            ? "Minha conta, verificando sessão"
            : "Minha conta, entrar"
        }
      >
        {icon}
      </Link>
    );
  return (
    <Dialog>
      <DialogTrigger aria-label="Minha conta">{icon}</DialogTrigger>
      <DialogContent className="account-sheet">
        <DialogTitle>Minha conta</DialogTitle>
        <DialogDescription>
          Conectado como {displayName(identity.session)} (
          {identity.session.user.email}).
        </DialogDescription>
        <DialogClose asChild>
          <Link className="button button-outline" to="/account/profile">
            Meu perfil
          </Link>
        </DialogClose>
        <DialogClose asChild>
          <Link className="button button-outline" to="/account/wallets">
            Carteiras
          </Link>
        </DialogClose>
        <button
          className="button button-primary"
          onClick={() => void signOut()}
        >
          Sair
        </button>
      </DialogContent>
    </Dialog>
  );
}
// Session expiry during navigation: the public context stays usable and the
// user goes to the login with the current page (search and hash) as target.
export function ExpiryRedirect() {
  const router = useRouter();
  const navigate = useNavigate();
  useEffect(
    () =>
      onSessionExpired(() => {
        const location = router.state.location;
        if (
          ["/login", "/signup"].includes(location.pathname) ||
          location.state.auth
        )
          return;
        // Over the current page, so it stays as it was behind the login.
        void navigate(authLink("login", location.href));
      }),
    [router, navigate],
  );
  return null;
}
// Visible, polite announcements; the same text is re-announced by clearing
// first. Messages fade after a few seconds.
export function Notices() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer = 0;
    const unsubscribe = subscribeNotices((next) => {
      setMessage("");
      window.clearTimeout(timer);
      requestAnimationFrame(() => setMessage(next));
      timer = window.setTimeout(() => setMessage(""), 8000);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);
  return (
    <div className="notices" role="status">
      {message && <p>{message}</p>}
    </div>
  );
}
