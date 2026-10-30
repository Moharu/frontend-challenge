import { useState, type ReactNode } from "react";
import { ensFull, ensLocal } from "@/lib/account-form";
// Account form fields (profile and wallets), with the checkout's field
// styles: label with an asterisk only when required, error linked to the
// input, and rules shown only in the error message.
interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  hiddenLabel?: boolean;
  children?: ReactNode;
}
export function Label({
  id,
  label,
  required,
  hidden,
}: {
  id: string;
  label: string;
  required?: boolean;
  hidden?: boolean;
}) {
  return (
    <label htmlFor={id} className={hidden ? "sr-only" : undefined}>
      {label}
      {required && (
        <span className="required" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}
export function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={`${id}-error`} className="auth-error">
      {error}
    </p>
  ) : null;
}
export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  required,
  type = "text",
  autoComplete,
  placeholder,
  hiddenLabel,
  children,
}: FieldProps) {
  return (
    <div
      className={`checkout-field${hiddenLabel ? " checkout-unlabeled" : ""}`}
    >
      <Label id={id} label={label} required={required} hidden={hiddenLabel} />
      <div className={children ? "checkout-input-suffix" : undefined}>
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {children}
      </div>
      <FieldError id={id} error={error} />
    </div>
  );
}
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 20 20 4" />}
    </svg>
  );
}
// Password with show/hide, as in the frame (an eye inside the field).
export function PasswordField(props: Omit<FieldProps, "type" | "children">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="checkout-field">
      <Label id={props.id} label={props.label} required={props.required} />
      <div className="account-password">
        <input
          id={props.id}
          name={props.id}
          type={visible ? "text" : "password"}
          value={props.value}
          autoComplete={props.autoComplete}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={props.error ? `${props.id}-error` : undefined}
          onChange={(e) => props.onChange(e.target.value)}
        />
        <button
          type="button"
          className="account-reveal"
          aria-label={`Mostrar ${props.label.toLowerCase()}`}
          aria-pressed={visible}
          aria-controls={props.id}
          onClick={() => setVisible((v) => !v)}
        >
          <EyeIcon open={visible} />
        </button>
      </div>
      <FieldError id={props.id} error={props.error} />
    </div>
  );
}
// "Nome ENS": the frame's `.eth` selector next to the name.
export function EnsField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="checkout-field">
      <Label id={id} label="Nome ENS" />
      <div className="account-ens">
        <select aria-label="Domínio ENS" defaultValue=".eth">
          <option value=".eth">.eth</option>
        </select>
        <input
          id={id}
          name={id}
          value={ensLocal(value)}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(ensFull(e.target.value))}
        />
      </div>
      <FieldError id={id} error={error} />
    </div>
  );
}
export function SelectField({
  id,
  label,
  value,
  onChange,
  error,
  required,
  placeholder,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder: string;
  options: [value: string, label: string][];
}) {
  return (
    <div className="checkout-field">
      <Label id={id} label={label} required={required} />
      <select
        id={id}
        name={id}
        value={value}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <FieldError id={id} error={error} />
    </div>
  );
}
