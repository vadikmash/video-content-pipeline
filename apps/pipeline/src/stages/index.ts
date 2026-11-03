import type { StageDef } from "./context";
import { assets } from "./assets";
import { publish } from "./publish";
import { render } from "./render";
import { research } from "./research";
import { storyboard } from "./storyboard";
import { upload } from "./upload";
import { voice } from "./voice";
import { write } from "./write";

export { research, write, voice, storyboard, assets, render, upload, publish };
export * from "./context";
export * from "./runner";

/** Work stages in pipeline order (gates are not here; see core GATES). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WORK_STAGES: StageDef<any>[] = [research, write, voice, storyboard, assets, render, upload, publish];
