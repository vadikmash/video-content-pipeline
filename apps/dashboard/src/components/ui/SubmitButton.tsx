"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./Button";

/** A submit `Button` that disables itself while its form's action is in flight. */
export function SubmitButton({ disabled, ...rest }: Omit<ButtonProps, "type" | "href">) {
  const { pending } = useFormStatus();
  return <Button {...rest} type="submit" disabled={disabled || pending} aria-busy={pending || undefined} />;
}
