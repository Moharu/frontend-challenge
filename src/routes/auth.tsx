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
          <button
            className="auth-back max-[701px]:place-items-center max-[701px]:w-[36px] max-[701px]:h-[36px] max-[701px]:rounded-[50%] max-[701px]:bg-[color:var(--raised)] max-[701px]:text-[24px]"
            aria-label="Voltar"
            onClick={close}
          >
            ‹
          </button>
          <p
            className="auth-brand max-[701px]:mt-[8px] max-[701px]:mr-[0] max-[701px]:mb-[24px] max-[701px]:ml-[0] max-[701px]:text-center max-[701px]:font-bold max-[701px]:tracking-[2px]"
            aria-hidden="true"
          >
            KURIO
          </p>
          <nav
            className="auth-tabs items-center gap-[14px] mb-[12px]"
            aria-label="Acesso à conta"
          >
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
                <span className="mobile-only hidden max-[701px]:inline">
                  Criar perfil de colecionador
                </span>
                <span className="desktop-only max-[701px]:hidden">
                  Criar conta
                </span>
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
          <div className="auth-social grid gap-[10px]">
            {["Google", "Facebook"].map((provider) => (
              <Unavailable
                key={provider}
                label={`Continuar com ${provider}`}
                className="button button-outline"
                description="O login social ainda não está disponível nesta versão. Use e-mail e senha."
              >
                {provider === "Google" ? <GoogleIcon /> : <FacebookIcon />}
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
// Provider marks supplied with the Figma.
const GoogleIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path
      d="M16.4336 17.6055C14.6992 19.0703 12.4493 20 10 20C6.35547 20 3.15621 17.9922 1.42188 15.0625L2.07117 12.0695L4.94922 11.5352C5.61719 13.6914 7.63278 15.2734 10 15.2734C11.1484 15.2734 12.2148 14.9102 13.0938 14.2656L15.8594 14.6875L16.4336 17.6055Z"
      fill="#59C36A"
    />
    <path
      d="M16.4336 17.6055L15.8594 14.6875L13.0937 14.2656C12.2148 14.9102 11.1484 15.2734 10 15.2734V20C12.4493 20 14.6992 19.0703 16.4336 17.6055Z"
      fill="#00A66C"
    />
    <path
      d="M4.72656 10C4.72656 10.539 4.8086 11.0546 4.94922 11.5352L1.42188 15.0625C0.542969 13.5859 0 11.8515 0 10C0 8.1484 0.542969 6.41406 1.42188 4.9375L4.25285 5.42473L4.94922 8.46484C4.8086 8.94527 4.72656 9.4609 4.72656 10Z"
      fill="#FFDA2D"
    />
    <path
      d="M20 10C20 13.0468 18.5899 15.7773 16.4336 17.6055L13.0938 14.2656C13.7734 13.7734 14.3477 13.1171 14.7227 12.3437H10C9.67184 12.3437 9.41406 12.0859 9.41406 11.7578V8.24219C9.41406 7.91402 9.67184 7.65625 10 7.65625H19.25C19.5312 7.65625 19.7773 7.85543 19.8242 8.13668C19.9414 8.74609 20 9.37887 20 10V10Z"
      fill="#4086F4"
    />
    <path
      d="M14.7227 12.3437C14.3477 13.1171 13.7734 13.7734 13.0938 14.2656L16.4336 17.6055C18.5899 15.7773 20 13.0469 20 10C20 9.37887 19.9414 8.74609 19.8242 8.13668C19.7773 7.85543 19.5312 7.65625 19.25 7.65625H10V12.3437H14.7227Z"
      fill="#4175DF"
    />
    <path
      d="M16.5977 2.79293C16.6094 2.95699 16.5391 3.10937 16.4336 3.22652L13.9258 5.72262C13.7266 5.93355 13.3985 5.95699 13.1641 5.78121C12.2382 5.08984 11.1484 4.72656 10 4.72656C7.63278 4.72656 5.61719 6.30855 4.94922 8.46484L1.42188 4.9375C3.15621 2.00781 6.35547 0 10 0C12.332 0 14.6055 0.859375 16.3867 2.35934C16.5156 2.46484 16.5859 2.62887 16.5977 2.79293V2.79293Z"
      fill="#FF641A"
    />
    <path
      d="M13.1641 5.78121C13.3984 5.95703 13.7265 5.93355 13.9257 5.72262L16.4336 3.22652C16.5391 3.10938 16.6094 2.95703 16.5976 2.79293C16.5859 2.62883 16.5156 2.46484 16.3867 2.35934C14.6055 0.859375 12.332 0 10 0V4.72656C11.1484 4.72656 12.2382 5.08984 13.1641 5.78121Z"
      fill="#F0805F"
    />
  </svg>
);
const FacebookIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path
      d="M13.331 3.32083H15.1568V0.140833C14.8418 0.0975 13.7585 0 12.4968 0C6.72017 0 8.29184 6.54167 8.06184 7.5H5.15601V11.055H8.06101V20H11.6227V11.0558H14.4102L14.8527 7.50083H11.6218C11.7785 5.1475 10.9877 3.32083 13.331 3.32083V3.32083Z"
      fill="#3B5999"
    />
  </svg>
);
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
      <div className="auth-input relative">
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
            className="auth-reveal absolute grid place-items-center min-h-[36px] py-[0] px-[8px]"
            aria-label={`Mostrar ${label.toLowerCase()}`}
            aria-pressed={visible}
            aria-controls={id}
            onClick={() => setVisible((v) => !v)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {/* Crossed while the password is hidden (Figma). */}
              {!visible && <path d="M4 20 20 4" />}
            </svg>
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
      className="auth-form grid gap-[14px]"
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
      <div className="auth-forgot text-right text-[13px] text-[color:var(--accent)]">
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
      className="auth-form grid gap-[14px]"
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
        <span className="desktop-only max-[701px]:hidden">Criar conta</span>
        <span className="mobile-only hidden max-[701px]:inline">
          Criar perfil
        </span>
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
      className="button button-primary auth-submit w-[100%] h-[48px]"
      aria-disabled={pending}
    >
      {pending ? "Aguarde…" : children}
    </button>
  );
}
