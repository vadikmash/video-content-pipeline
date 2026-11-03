import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "./format";
import { Icon } from "./Icon";

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  return (
    <label className={cx("vcp-field", className)}>
      <span className="vcp-field-label">
        {label}
        {optional ? <span className="vcp-field-opt">optional</span> : null}
      </span>
      {children}
      {hint && !error ? <span className="vcp-field-hint">{hint}</span> : null}
      {error ? (
        <span className="vcp-field-error">
          <Icon name="alert" size={12} />
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx("vcp-input", className)} />;
}

export function Textarea({ className, rows = 3, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} {...rest} className={cx("vcp-input vcp-textarea", className)} />;
}

export type SelectOption = string | { value: string; label: string };

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
}

export function Select({ options, className, ...rest }: SelectProps) {
  return (
    <select {...rest} className={cx("vcp-input vcp-select", className)}>
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ),
      )}
    </select>
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  hint?: ReactNode;
}

export function Checkbox({ label, hint, className, ...rest }: CheckboxProps) {
  return (
    <label className={cx("vcp-check", className)}>
      <input type="checkbox" {...rest} />
      <span className="vcp-check-box" aria-hidden>
        <Icon name="check" size={12} stroke={3} />
      </span>
      <span className="vcp-check-text">
        <span>{label}</span>
        {hint ? <span className="vcp-field-hint">{hint}</span> : null}
      </span>
    </label>
  );
}
