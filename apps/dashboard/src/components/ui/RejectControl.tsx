"use client";

import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Field, Textarea } from "./Field";
import { cx } from "./format";
import { SubmitButton } from "./SubmitButton";

type FormAction = (formData: FormData) => void | Promise<void>;

/** Required reason plus the confirming "Reject and stop"; posts `reason`. */
export function RejectForm({
  action,
  onCancel,
  className,
}: {
  action: FormAction;
  onCancel: () => void;
  className?: string;
}) {
  const [reason, setReason] = useState("");
  return (
    <form action={action} className={className}>
      <Field label="Reason for rejecting" hint="The run stops here. Brief, script and assets are kept.">
        <Textarea
          name="reason"
          rows={2}
          required
          autoFocus
          value={reason}
          placeholder="e.g. Claim in beat 3 has no primary source"
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <div className="vcp-gate-actions">
        <SubmitButton variant="danger" icon="x" disabled={!reason.trim()}>
          Reject and stop
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** The header's ghost "Reject…" while a project runs between gates. */
export function RejectControl({ action, className }: { action: FormAction; className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className={cx("vcp-reject-ctl", className)}>
      <Button type="button" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
        Reject…
      </Button>
      {open ? (
        <div className="vcp-reject-pop" role="dialog" aria-label="Reject project">
          <RejectForm action={action} onCancel={() => setOpen(false)} className="vcp-reject-form" />
        </div>
      ) : null}
    </div>
  );
}
