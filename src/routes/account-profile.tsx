import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  newPasswordError,
  profileErrors,
  type Profile,
  type UpdateProfileRequest,
} from "@/contracts/profile";
import { apiError } from "@/lib/api-error";
import { AvatarError, prepareAvatar } from "@/lib/avatar";
import { profileKey, useProfile } from "@/data/account/hooks";
import {
  changePassword,
  updateAvatar,
  updateProfile,
} from "@/data/account/api";
import {
  cartScope,
  sameScope,
  updateSessionUser,
} from "@/data/session/identity";
import {
  EnsField,
  FieldError,
  PasswordField,
  TextField,
} from "@/components/account/fields";
import { useFocusFirstError } from "@/lib/account-form";
export function ProfilePage() {
  const profile = useProfile();
  return (
    <section className="account-section" aria-labelledby="account-title">
      <h1 id="account-title">Perfil do colecionador</h1>
      {profile.isError ? (
        <div className="query-error" role="alert">
          <p>Não foi possível carregar seu perfil.</p>
          <button
            className="button button-outline"
            onClick={() => void profile.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      ) : !profile.data ? (
        <p className="checkout-waiting" role="status">
          Carregando seu perfil…
        </p>
      ) : (
        <ProfileForm key={profile.data.userId} profile={profile.data} />
      )}
    </section>
  );
}
type Values = {
  displayName: string;
  username: string;
  email: string;
  ensName: string;
  walletNickname: string;
};
const valuesOf = (p: Profile): Values => ({
  displayName: p.displayName ?? "",
  username: p.username,
  email: p.email,
  ensName: p.ensName ?? "",
  walletNickname: p.walletNickname ?? "",
});
const emptyPasswords = { currentPassword: "", newPassword: "", confirm: "" };
type Part = "data" | "avatar" | "password";
const partNames: Record<Part, string> = {
  data: "Dados do perfil",
  avatar: "Avatar",
  password: "Senha",
};
// Avatar change waiting for "Salvar": a new image (data URL) or a removal.
type AvatarChange =
  { kind: "set"; dataUrl: string } | { kind: "remove" } | null;
function ProfileForm({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  // The last profile confirmed by the API: the base for changes and versions.
  const [base, setBase] = useState(profile);
  const [values, setValues] = useState(() => valuesOf(profile));
  const [passwords, setPasswords] = useState(emptyPasswords);
  const [avatar, setAvatar] = useState<AvatarChange>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [results, setResults] = useState<
    { part: Part; ok: boolean; message: string }[]
  >([]);
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const focusFirstError = useFocusFirstError("profile-");
  const set = (key: keyof Values) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  const setPassword = (key: keyof typeof emptyPasswords) => (value: string) =>
    setPasswords((p) => ({ ...p, [key]: value }));
  // Only the fields that differ from the confirmed profile are sent.
  function changes(from: Profile): Omit<UpdateProfileRequest, "version"> {
    const saved = valuesOf(from);
    const patch: Record<string, string | null> = {};
    for (const key of Object.keys(values) as (keyof Values)[]) {
      const value = values[key].trim();
      if (value === saved[key]) continue;
      patch[key] =
        key === "username" || key === "email" ? value : value || null;
    }
    return patch;
  }
  async function pickAvatar(chosen: File | undefined) {
    if (!chosen) return;
    setErrors(({ avatar: _avatar, ...rest }) => (void _avatar, rest));
    try {
      setAvatar({ kind: "set", dataUrl: await prepareAvatar(chosen) });
    } catch (e) {
      setErrors((current) => ({
        ...current,
        avatar:
          e instanceof AvatarError
            ? e.message
            : "Não foi possível processar a imagem.",
      }));
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const patch = changes(base);
    const passwordFilled = Object.values(passwords).some(Boolean);
    // Client validation of everything that will be sent.
    const found: Record<string, string> = profileErrors(patch);
    if (passwordFilled) {
      if (!passwords.currentPassword)
        found.currentPassword = "Informe a senha atual.";
      const problem = newPasswordError(passwords.newPassword);
      if (problem) found.newPassword = problem;
      else if (passwords.confirm !== passwords.newPassword)
        found.confirm = "A confirmação não corresponde à nova senha.";
    }
    if (Object.keys(found).length) {
      setErrors(found);
      setResults([]);
      focusFirstError();
      return;
    }
    if (!Object.keys(patch).length && !avatar && !passwordFilled) {
      setErrors({});
      setResults([
        { part: "data", ok: true, message: "Nenhuma alteração para salvar." },
      ]);
      return;
    }
    setSaving(true);
    setErrors({});
    const scope = cartScope();
    const outcome: { part: Part; ok: boolean; message: string }[] = [];
    const failed: Record<string, string> = {};
    let current = base;
    // 1. Profile data, 2. avatar (with the version returned by step 1),
    // 3. password. Each part stands on its own: what succeeds stays saved.
    if (Object.keys(patch).length) {
      try {
        current = await updateProfile({ ...patch, version: current.version });
        outcome.push({ part: "data", ok: true, message: "salvos." });
      } catch (e) {
        const info = apiError(e);
        Object.assign(failed, info.fields);
        outcome.push({ part: "data", ok: false, message: info.message });
      }
    }
    if (avatar) {
      try {
        current = await updateAvatar({
          dataUrl: avatar.kind === "set" ? avatar.dataUrl : null,
          version: current.version,
        });
        outcome.push({
          part: "avatar",
          ok: true,
          message: avatar.kind === "set" ? "salvo." : "removido.",
        });
      } catch (e) {
        const info = apiError(e);
        failed.avatar = info.fields.avatar ?? info.message;
        outcome.push({ part: "avatar", ok: false, message: info.message });
      }
    }
    if (passwordFilled) {
      try {
        await changePassword({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword,
        });
        outcome.push({ part: "password", ok: true, message: "alterada." });
      } catch (e) {
        const info = apiError(e);
        Object.assign(failed, info.fields);
        outcome.push({ part: "password", ok: false, message: info.message });
      }
    }
    setSaving(false);
    if (!sameScope(scope, cartScope())) return;
    // What was saved comes from the API; what failed keeps what was typed.
    if (current !== base) {
      setBase(current);
      queryClient.setQueryData(profileKey(scope), current);
      updateSessionUser({
        id: current.userId,
        username: current.username,
        displayName: current.displayName,
        email: current.email,
      });
      const savedValues = valuesOf(current);
      setValues((typed) => {
        const next = { ...typed };
        for (const key of Object.keys(typed) as (keyof Values)[])
          if (!(key in failed)) next[key] = savedValues[key];
        return next;
      });
    }
    if (outcome.some((o) => o.part === "avatar" && o.ok)) setAvatar(null);
    if (outcome.some((o) => o.part === "password" && o.ok))
      setPasswords(emptyPasswords);
    setErrors(failed);
    setResults(outcome);
    if (Object.keys(failed).length) focusFirstError();
  }
  const shown =
    avatar?.kind === "set"
      ? { src: avatar.dataUrl, alt: "Prévia do novo avatar" }
      : avatar?.kind === "remove" || !base.avatar
        ? null
        : { src: base.avatar, alt: `Avatar de ${base.username}` };
  const failedParts = results.filter((r) => !r.ok);
  return (
    <form className="account-form" noValidate onSubmit={(e) => void save(e)}>
      <div className="account-grid">
        <TextField
          id="profile-displayName"
          label="Nome de exibição"
          autoComplete="name"
          value={values.displayName}
          onChange={set("displayName")}
          error={errors.displayName}
        />
        <TextField
          id="profile-username"
          label="Nome de usuário"
          required
          autoComplete="username"
          value={values.username}
          onChange={set("username")}
          error={errors.username}
        />
        <TextField
          id="profile-email"
          label="E-mail"
          required
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={set("email")}
          error={errors.email}
        />
        <EnsField
          id="profile-ensName"
          value={values.ensName}
          onChange={set("ensName")}
          error={errors.ensName}
        />
        <TextField
          id="profile-walletNickname"
          label="Apelido da carteira"
          value={values.walletNickname}
          onChange={set("walletNickname")}
          error={errors.walletNickname}
        />
        <div className="checkout-field account-avatar">
          <span id="profile-avatar-label" className="account-label">
            Avatar
          </span>
          <div className="account-avatar-row">
            <span className="account-avatar-image">
              {shown ? (
                <img src={shown.src} alt={shown.alt} width="64" height="64" />
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle
                    cx="12"
                    cy="12"
                    r="8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M9 10h.01M15 10h.01M8.5 14c1.8 2 5.2 2 7 0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              {!shown && <span className="sr-only">Sem avatar</span>}
            </span>
            <input
              ref={file}
              id="profile-avatar"
              type="file"
              accept="image/webp,image/jpeg,image/png"
              // Opened by "Alterar"; out of the layout and the tab order.
              hidden
              aria-labelledby="profile-avatar-label"
              aria-invalid={errors.avatar ? true : undefined}
              aria-describedby={
                errors.avatar ? "profile-avatar-error" : undefined
              }
              onChange={(e) => void pickAvatar(e.target.files?.[0])}
            />
            <button
              type="button"
              className="button button-primary"
              aria-describedby={
                errors.avatar ? "profile-avatar-error" : undefined
              }
              onClick={() => file.current?.click()}
            >
              Alterar
            </button>
            <button
              type="button"
              className="account-text-button"
              disabled={!shown}
              onClick={() => setAvatar(base.avatar ? { kind: "remove" } : null)}
            >
              Remover
            </button>
          </div>
          <FieldError id="profile-avatar" error={errors.avatar} />
        </div>
      </div>
      <fieldset className="account-password-group">
        <legend>Alterar senha</legend>
        <PasswordField
          id="profile-currentPassword"
          label="Senha atual"
          autoComplete="current-password"
          value={passwords.currentPassword}
          onChange={setPassword("currentPassword")}
          error={errors.currentPassword}
        />
        <PasswordField
          id="profile-newPassword"
          label="Nova senha"
          autoComplete="new-password"
          value={passwords.newPassword}
          onChange={setPassword("newPassword")}
          error={errors.newPassword}
        />
        <PasswordField
          id="profile-confirm"
          label="Confirmar nova senha"
          autoComplete="new-password"
          value={passwords.confirm}
          onChange={setPassword("confirm")}
          error={errors.confirm}
        />
      </fieldset>
      <button
        type="submit"
        className="button button-primary account-save"
        aria-disabled={saving}
      >
        {saving ? "Salvando…" : "Salvar"}
      </button>
      {/* One summary per save, part by part: never a general success when
          something failed. */}
      <div className="account-summary" role="status">
        {results.length > 0 && (
          <>
            <p>
              {failedParts.length === 0
                ? "Alterações salvas."
                : failedParts.length === results.length
                  ? "Nada foi salvo."
                  : "Algumas alterações foram salvas; revise o que falhou."}
            </p>
            <ul>
              {results.map((r) => (
                <li key={r.part} className={r.ok ? "ok" : "failed"}>
                  {r.message === "Nenhuma alteração para salvar."
                    ? r.message
                    : `${partNames[r.part]}: ${r.ok ? r.message : `não salvo. ${r.message}`}`}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </form>
  );
}
