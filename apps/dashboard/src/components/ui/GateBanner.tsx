"use client";

import { useState } from "react";
import { Button } from "./Button";
import { cx } from "./format";
import { Icon } from "./Icon";
import { RejectForm } from "./RejectControl";
import { SubmitButton } from "./SubmitButton";

export type GateName = "approve-script" | "approve-video" | "approve-publish";

const GATES: Record<GateName, { title: string; body: string; cta: string }> = {
  "approve-script": {
    title: "Script ready for review",
    body: "Edit the script below if needed, then approve to start voice.",
    cta: "Approve script",
  },
  "approve-video": {
    title: "Render ready for review",
    body: "Watch the render end to end. Approving uploads it as private.",
    cta: "Approve video",
  },
  "approve-publish": {
    title: "Ready to publish",
    body: "Uploaded as private. Publish now, or pick a time to schedule it.",
    cta: "Publish",
  },
};

type FormAction = (formData: FormData) => void | Promise<void>;

export interface GateBannerProps {
  gate: GateName;
  approveAction: FormAction;
  rejectAction: FormAction;
  /** True when the artifact the gate judges is missing. */
  disabled?: boolean;
  title?: string;
  description?: string;
  className?: string;
}

export function GateBanner({ gate, approveAction, rejectAction, disabled, title, description, className }: GateBannerProps) {
  const g = GATES[gate];
  const [rejecting, setRejecting] = useState(false);
  const [when, setWhen] = useState("");
  const isPublish = gate === "approve-publish";
  return (
    <section className={cx("vcp-gate", className)} aria-label={`Paused for you: ${title ?? g.title}`}>
      <div className="vcp-gate-kicker">
        <Icon name="pause" size={14} stroke={2.5} />
        <span>Paused for you</span>
        <span className="vcp-gate-stage">{gate}</span>
      </div>
      <div className="vcp-gate-body">
        <div className="vcp-gate-text">
          <h2 className="vcp-gate-title">{title ?? g.title}</h2>
          <p className="vcp-gate-desc">{description ?? g.body}</p>
        </div>
        {!rejecting ? (
          <form action={approveAction} className="vcp-gate-actions">
            {isPublish ? (
              <label className="vcp-field vcp-gate-when">
                <span className="vcp-field-label">
                  Schedule<span className="vcp-field-opt">optional</span>
                </span>
                <input
                  type="datetime-local"
                  name="publishAt"
                  className="vcp-input"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </label>
            ) : null}
            <SubmitButton variant="primary" icon="check" className="vcp-gate-approve" disabled={disabled}>
              {isPublish && when ? "Schedule" : g.cta}
            </SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setRejecting(true)}>
              Reject…
            </Button>
          </form>
        ) : null}
      </div>
      {rejecting ? (
        <RejectForm action={rejectAction} onCancel={() => setRejecting(false)} className="vcp-gate-reject" />
      ) : null}
    </section>
  );
}
