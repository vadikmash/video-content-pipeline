"use client";

import { Select, type SelectProps } from "./Field";

/** A `Select` that submits its form as soon as the value changes. */
export function AutoSubmitSelect(props: SelectProps) {
  return <Select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
