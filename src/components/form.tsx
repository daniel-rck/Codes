/**
 * Small form primitives (inputs, selects, fields) styled with the app's design
 * tokens. Complements the web-base UI primitives without modifying them.
 */
import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from "react";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const FIELD_BASE =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg " +
  "placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent-500 disabled:opacity-50";

export type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string) => ReactNode;
};

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD_BASE, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD_BASE, "min-h-24 resize-y", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(FIELD_BASE, "appearance-none", className)} {...rest}>
      {children}
    </select>
  );
}

export type ChipProps = {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
};

export function Chip({ active, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-accent-600 text-white"
          : "bg-surface-muted text-fg-muted hover:bg-surface-sunken border border-border",
      )}
    >
      {children}
    </button>
  );
}

export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-fg cursor-pointer select-none">
      <span
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          checked ? "bg-accent-600" : "bg-surface-sunken border border-border",
        )}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
      {label}
    </label>
  );
}
