// Type-level export check compiled with the authored module.
import type { ReactNode } from "react";
import type { SequenceProps } from "@vcp/motion";
import Authored from "./sequence";

export const sequenceExport: (props: SequenceProps) => ReactNode = Authored;
