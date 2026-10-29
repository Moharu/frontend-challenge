import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  useNavigate,
  useRouter,
  useRouterState,
  useSearch,
} from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Unavailable } from "@/components/discovery/shared";
import { emailPattern, registrationErrors } from "@/contracts/session";
import type { AuthResponse } from "@/contracts/session";
import { login, register } from "@/data/session/identity";
import { notify } from "@/data/session/notices";
import { apiError } from "@/lib/api-error";
import {
  authLink,
  dialogShown,
  loadedEntry,
  resumeScrollRestoration,
  safeRedirect,
  targetLocation,
} from "@/lib/redirect";
import { IndexPage } from "@/routes/index";
type Mode = "login" | "signup";
export const LoginPage = () => <AuthScreen mode="login" />;
export const SignupPage = () => <AuthScreen mode="signup" />;
const copy = {
  login: {
    description:
      "Entre para gerenciar sua carteira, coleção e perfil de criador.",
  },
  signup: {
    description:
      "Crie seu perfil de colecionador e conecte uma carteira quando quiser.",
  },
};
// Element that opened the auth screen. The dialog closes by leaving the route
// or the history entry, so Radix never sees a close and cannot return focus
// itself. Switching between the login and signup tabs keeps the opener.
let opener: HTMLElement | null = null;
const restoreFocus = () => {
  if (opener?.isConnected) opener.focus();
  opener = null;
};
// Direct load or reload of /login or /signup: there is no live page to keep,
// so the dialog opens over the home page.
function AuthScreen({ mode }: { mode: Mode }) {
  const search = useSearch({ strict: false }) as { redirect?: string };
  const target = safeRedirect(search.redirect);
  const navigate = useNavigate();
  return (
    <>
      <IndexPage />
      <AuthDialog
        mode={mode}
        target={target}
        close={() => void navigate(targetLocation(target)).then(restoreFocus)}
      />
    </>
  );
}
// In-app opening (see `authLink`): the router keeps the current page as its
// real location, so it stays mounted with its filters, scroll and drafts; the
// address bar shows the masked /login or /signup URL. Closing goes back one
// history entry, and a successful login replaces the entry with the page.
export function AuthOverlay({ mode }: { mode: Mode }) {
  const router = useRouter();
  const navigate = useNavigate();
  const target = useRouterState({
    // Carried in history state by `authLink`: for a masked location the
    // router's own href/hash lose the hash.
    select: (state) => safeRedirect(state.location.state.authTarget),
  });
  const background = useRouterState({
    select: (state) =>
      safeRedirect(
        state.location.state.authBackground ?? state.location.state.authTarget,
      ),
  });
  useEffect(
    () => () => {
      requestAnimationFrame(restoreFocus);
    },
    [],
  );
  return (
    <AuthDialog
      mode={mode}
      target={target}
      overlay={background}
      close={() => {
        // After a reload, going back would land on the earlier load's entry
        // and the browser would restore its old scroll; stay on this page.
        const entry = (window.history.state as { __TSR_index?: number } | null)
          ?.__TSR_index;
        if (loadedEntry !== undefined && entry === loadedEntry)
          void navigate({
            ...targetLocation(background),
            replace: true,
            hashScrollIntoView: false,
          }).then(() => requestAnimationFrame(resumeScrollRestoration));
        else router.history.back();
      }}
    />
  );
}
// Desktop: the Figma modal over the page (no strong dimming, background
// inert). Mobile (≤700px): the same dialog fills the screen, with a back button.
function AuthDialog({
  mode,
  target,
  overlay,
  close,
}: {
  mode: Mode;
  target: string;
  // In-app opening: the page kept behind the dialog.
  overlay?: string;
  close: () => void;
}) {
  const first = useRef<HTMLInputElement>(null);
  useEffect(dialogShown, []);
  useState(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && !active.closest("[role=dialog]"))
      opener = active;
  });
  // Tabs switch mode in place (replacing the entry), never stacking history.
  const modeLink = (to: Mode) =>
    overlay !== undefined
      ? { ...authLink(to, target, overlay), replace: true }
      : { to: `/${to}` as const, search: { redirect: target } };
  return (
    <>
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent
          className="auth-dialog"
          overlayClassName="auth-overlay"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            first.current?.focus();
          }}
        >
          <button className="auth-back" aria-label="Voltar" onClick={close}>
            ‹
          </button>
          <p className="auth-brand" aria-hidden="true">
            KURIO
          </p>
          <nav className="auth-tabs" aria-label="Acesso à conta">
            <Link
              {...modeLink("login")}
              aria-current={mode === "login" ? "page" : undefined}
            >
              Entrar
            </Link>
            <span aria-hidden="true">|</span>
            <Link
              {...modeLink("signup")}
              aria-current={mode === "signup" ? "page" : undefined}
            >
              Criar conta
            </Link>
          </nav>
          <DialogTitle className="auth-title">
            {mode === "login" ? (
              "Entrar"
            ) : (
              <>
                <span className="mobile-only">
                  Criar perfil de colecionador
                </span>
                <span className="desktop-only">Criar conta</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="auth-description">
            {copy[mode].description}
          </DialogDescription>
          {mode === "login" ? (
            <LoginForm first={first} target={target} />
          ) : (
            <SignupForm first={first} target={target} />
          )}
          <p className="auth-divider">
            <span>Ou continue com</span>
          </p>
          <div className="auth-social">
            {["Google", "Facebook"].map((provider) => (
              <Unavailable
                key={provider}
                label={`Continuar com ${provider}`}
                className="button button-outline"
                description="O login social ainda não está disponível nesta versão. Use e-mail e senha."
              >
                Continuar com {provider}
              </Unavailable>
            ))}
          </div>
          <p className="auth-switch">
            {mode === "login" ? (
              <>
                Novo na Kurio?{" "}
                <Link {...modeLink("signup")}>Crie uma conta</Link>
              </>
            ) : (
              <>
                Já tem uma conta? <Link {...modeLink("login")}>Entre</Link>
              </>
            )}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
interface FieldProps {
  name: string;
  label: string;
  type?: string;
  placeholder: string;
  autoComplete: string;
  error?: string;
  hint?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  reveal?: boolean;
}
// Labels are always associated (visually hidden to keep the placeholder-only
// composition); rules are shown before any error; errors are announced.
function Field({
  name,
  label,
  type = "text",
  placeholder,
  autoComplete,
  error,
  hint,
  inputRef,
  value,
  onChange,
  reveal = false,
}: FieldProps) {
  const [visible, setVisible] = useState(false);
  const id = `auth-${name}`;
  const described =
    [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="auth-field">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="auth-input">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type={reveal && visible ? "text" : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          onChange={(event) => onChange(event.target.value)}
        />
        {reveal && (
          <button
            type="button"
            className="auth-reveal"
            aria-label={`Mostrar ${label.toLowerCase()}`}
            aria-pressed={visible}
            aria-controls={id}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? "Ocultar" : "Mostrar"}
          </button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="auth-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="auth-error">
          {error}
        </p>
      )}
    </div>
  );
}
function welcome(result: AuthResponse, created: boolean) {
  const user = result.session.user;
  const parts = [
    `${created ? "Conta criada. " : ""}Você entrou como ${user.displayName ?? user.username}.`,
  ];
  const merge = result.merge;
  if (merge) {
    const lines = merge.addedLines + merge.mergedLines;
    if (lines)
      parts.push(
        `${lines} ${lines === 1 ? "linha do carrinho de visitante foi juntada" : "linhas do carrinho de visitante foram juntadas"} ao seu carrinho.`,
      );
    if (merge.conflictLines)
      parts.push(
        `${merge.conflictLines} ${merge.conflictLines === 1 ? "linha precisa" : "linhas precisam"} de ajuste no carrinho.`,
      );
  }
  notify(parts.join(" "));
}
// Shared submit flow: client validation with focus on the first invalid field,
// one pending request at a time, API field errors mapped to inputs and other
// failures in an alert summary, keeping what was typed.
function useAuthSubmit(
  order: string[],
  validate: () => Record<string, string>,
  request: () => Promise<AuthResponse>,
  created: boolean,
  target: string,
) {
  const navigate = useNavigate();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const focusFirst = (found: Record<string, string>) => {
    const name = order.find((key) => found[key]);
    if (name) document.getElementById(`auth-${name}`)?.focus();
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setSummary(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirst(found);
      return;
    }
    setPending(true);
    try {
      const result = await request();
      welcome(result, created);
      // Replace: going back must not reopen the login.
      await navigate({ ...targetLocation(target), replace: true });
    } catch (error) {
      const info = apiError(error);
      const fields = Object.fromEntries(
        Object.entries(info.fields).filter(([key]) => order.includes(key)),
      );
      if (Object.keys(fields).length) {
        setErrors(fields);
        focusFirst(fields);
      } else setSummary(info.message);
    } finally {
      setPending(false);
    }
  }
  return { errors, summary, pending, submit };
}
function LoginForm({
  first,
  target,
}: {
  first: React.RefObject<HTMLInputElement | null>;
  target: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { errors, summary, pending, submit } = useAuthSubmit(
    ["email", "password"],
    () => ({
      ...(emailPattern.test(email.trim())
        ? {}
        : { email: "Informe um e-mail válido." }),
      ...(password ? {} : { password: "Informe sua senha." }),
    }),
    () => login(email.trim(), password),
    false,
    target,
  );
  return (
    <form
      className="auth-form"
      aria-label="Entrar"
      noValidate
      onSubmit={(e) => void submit(e)}
    >
      <FormSummary>{summary}</FormSummary>
      <Field
        name="email"
        label="E-mail"
        type="email"
        placeholder="Digite seu e-mail"
        autoComplete="email"
        inputRef={first}
        value={email}
        onChange={setEmail}
        error={errors.email}
      />
      <Field
        name="password"
        label="Senha"
        type="password"
        placeholder="Senha"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        error={errors.password}
        reveal
      />
      <div className="auth-forgot">
        <Unavailable
          label="Esqueceu a senha?"
          description="A recuperação de senha ainda não está disponível nesta versão."
        >
          Esqueceu a senha?
        </Unavailable>
      </div>
      <Submit pending={pending}>Entrar</Submit>
    </form>
  );
}
function SignupForm({
  first,
  target,
}: {
  first: React.RefObject<HTMLInputElement | null>;
  target: string;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { errors, summary, pending, submit } = useAuthSubmit(
    ["username", "email", "password", "confirm"],
    () => ({
      ...registrationErrors({ username, email, password }),
      // Confirmation is checked only here; it never travels to the API.
      ...(confirm === password ? {} : { confirm: "As senhas não coincidem." }),
    }),
    () =>
      register({ username: username.trim(), email: email.trim(), password }),
    true,
    target,
  );
  return (
    <form
      className="auth-form"
      aria-label="Criar conta"
      noValidate
      onSubmit={(e) => void submit(e)}
    >
      <FormSummary>{summary}</FormSummary>
      <Field
        name="username"
        label="Nome de usuário"
        placeholder="Nome de usuário"
        autoComplete="username"
        inputRef={first}
        value={username}
        onChange={setUsername}
        error={errors.username}
        hint="De 3 a 20 caracteres: letras sem acento, números ou _."
      />
      <Field
        name="email"
        label="E-mail"
        type="email"
        placeholder="Digite seu e-mail"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        error={errors.email}
      />
      <Field
        name="password"
        label="Senha"
        type="password"
        placeholder="Senha"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        error={errors.password}
        hint="Mínimo de 8 caracteres, com pelo menos uma letra e um número."
        reveal
      />
      <Field
        name="confirm"
        label="Confirmar senha"
        type="password"
        placeholder="Confirmar senha"
        autoComplete="new-password"
        value={confirm}
        onChange={setConfirm}
        error={errors.confirm}
        reveal
      />
      <Submit pending={pending}>
        <span className="desktop-only">Criar conta</span>
        <span className="mobile-only">Criar perfil</span>
      </Submit>
    </form>
  );
}
function FormSummary({ children }: { children: ReactNode }) {
  return (
    <p className="auth-summary" role="alert">
      {children}
    </p>
  );
}
function Submit({
  pending,
  children,
}: {
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className="button button-primary auth-submit"
      aria-disabled={pending}
    >
      {pending ? "Aguarde…" : children}
    </button>
  );
}
