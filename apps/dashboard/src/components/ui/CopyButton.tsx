"use client";

import { useState } from "react";
import { Icon } from "./Icon";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="vcp-copy"
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      title={copied ? "Copied" : "Copy"}
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={13} />
    </button>
  );
}
