import type { ZodType } from "zod";
import type {
  Asset,
  BlobRef,
  Idea,
  NewIdea,
  Privacy,
  Render,
  Storyboard,
  Upload,
  UploadMeta,
  Word,
} from "./schemas";

// ---------------------------------------------------------------------------
// Shared argument types
// ---------------------------------------------------------------------------

export interface DiscoverCtx {
  /** ISO timestamp of the last successful discovery for this source, if any. */
  since?: string;
  limit?: number;
}

export type PromptKind = "brief" | "script" | "storyboard" | "animation" | "score" | "other";

/** An image the pipeline produced itself (for example a rendered frame), sent as a real image block. */
export interface PromptImage {
  mediaType: "image/jpeg" | "image/png";
  data: Uint8Array;
  /** Short caption placed before the image, such as "frame 607 (20.23s)". */
  label?: string;
}

/** Usage for one provider response, including a schema-repair response. */
export interface PromptUsage {
  provider: string;
  /** Model that actually responded (may differ from the request on a fallback). */
  model: string;
  requestId?: string;
  /** 0 for the first response of a logical generation, 1 for its schema repair. */
  repair: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  /** Set when counts are estimated rather than reported; names the estimator. */
  estimator?: string;
}

export interface Prompt {
  kind: PromptKind;
  system?: string;
  user: string;
  /** Structured context the model may use; fakes key fixtures off this. */
  context?: Record<string, unknown>;
  /** Images placed before the user text. Only for models with image input. */
  images?: PromptImage[];
  /** Called once per provider response; `generate` still returns only the parsed value. */
  onUsage?: (usage: PromptUsage) => void;
  signal?: AbortSignal;
  /** Output-token cap including reasoning, for steps whose output is long (authored source). Adapters clamp to the model's limit. */
  maxOutputTokens?: number;
}

export interface Voice {
  voiceId: string;
  /** Provider-specific tuning, passed through untouched. */
  options?: Record<string, unknown>;
}

export interface StockSearchOpts {
  orientation?: "portrait" | "landscape" | "square";
  minDurationSec?: number;
  perPage?: number;
}

export interface ImageGenOpts {
  width?: number;
  height?: number;
  style?: string;
  /** Identifies one generation across retries of the same scene. */
  requestId?: string;
}

export interface ClipGenOpts {
  width?: number;
  height?: number;
  image?: Uint8Array;
}

export interface TemplateRef {
  id: string;
  version: string;
}

/** Resolved assets for a storyboard, keyed by asset id. */
export type AssetBundle = Record<string, Asset>;

export interface RenderInput {
  storyboard: Storyboard;
  bundle: AssetBundle;
  template: TemplateRef;
  /** Narration audio + words, needed by the template. */
  narration: { audioBlob: BlobRef; words: Word[]; durationSec: number };
  /** Text shown on the title card. */
  title: string;
  /** Beat texts keyed by beat id for captions. */
  beats: Record<string, string>;
  /** Source URLs for the closing card. */
  sources?: string[];
  projectId: string;
}

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

export interface IdeaSource {
  id: string;
  discover(ctx: DiscoverCtx): Promise<NewIdea[]>;
}

export interface TextModel {
  id: string;
  /** Whether the configured model accepts `Prompt.images`. Absent means no. */
  capabilities?: { images: boolean; model?: string };
  generate<T>(schema: ZodType<T>, prompt: Prompt): Promise<T>;
}

export interface WebResearch {
  id: string;
  search(q: string): Promise<SearchResult[]>;
  fetch(url: string): Promise<string>;
}

export interface Speech {
  id: string;
  synthesize(text: string, voice: Voice): Promise<{ audio: Uint8Array; contentType: string; words?: Word[] }>;
}

export interface Aligner {
  id: string;
  align(audio: Uint8Array, text: string): Promise<Word[]>;
}

export interface StockSearch {
  id: string;
  search(q: string, opts: StockSearchOpts): Promise<Asset[]>;
  fetch(asset: Asset): Promise<Uint8Array>;
}

export interface ImageGen {
  id: string;
  generate(prompt: string, opts: ImageGenOpts): Promise<Asset>;
}

export interface ClipGen {
  id: string;
  generate(prompt: string, seconds: number, opts: ClipGenOpts): Promise<Asset>;
}

export type RenderProfile = "draft" | "full";

export interface PreviewOptions {
  profile: RenderProfile;
  /** Half-open global composition frame range. */
  startFrame: number;
  endFrame: number;
  /** Global composition frames to return as JPEG stills (inside the range). */
  frames?: number[];
  signal?: AbortSignal;
}

export interface PreviewFrame {
  frame: number;
  timeSec: number;
  blob: BlobRef;
}

/** A playable excerpt of the composition with voice and captions. Never a `Render`. */
export interface Preview {
  id: string;
  projectId: string;
  profile: RenderProfile;
  startFrame: number;
  endFrame: number;
  width: number;
  height: number;
  fps: number;
  video: BlobRef;
  frames: PreviewFrame[];
  provider: string;
  createdAt: string;
}

export interface Renderer {
  id: string;
  render(input: RenderInput): Promise<Render>;
  /** Draft or full excerpt for inspection; stored under previews, outside the approval flow. */
  preview?(input: RenderInput, options: PreviewOptions): Promise<Preview>;
}

export interface Publisher {
  id: string;
  upload(render: Render, meta: UploadMeta, privacy: Privacy): Promise<Upload>;
  setPrivacy(upload: Upload, privacy: Privacy, publishAt?: string): Promise<Upload>;
  status(upload: Upload): Promise<Upload>;
}

export interface BlobStore {
  id: string;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<BlobRef>;
  get(ref: BlobRef): Promise<Uint8Array>;
  /** URL usable by the dashboard and the renderer. `ttl` in seconds; ignored by local disk. */
  url(ref: BlobRef, ttl?: number): Promise<string>;
  /** Absolute filesystem path when the store is local; undefined otherwise. */
  localPath?(ref: BlobRef): string;
  /** Root directory when the store is local disk. */
  localRoot?(): string;
}

// ---------------------------------------------------------------------------
// Port registry types
// ---------------------------------------------------------------------------

export interface PortMap {
  IdeaSource: IdeaSource;
  TextModel: TextModel;
  WebResearch: WebResearch;
  Speech: Speech;
  Aligner: Aligner;
  StockSearch: StockSearch;
  ImageGen: ImageGen;
  ClipGen: ClipGen;
  Renderer: Renderer;
  Publisher: Publisher;
  BlobStore: BlobStore;
}

export type PortName = keyof PortMap;

export const PORT_NAMES: readonly PortName[] = [
  "IdeaSource",
  "TextModel",
  "WebResearch",
  "Speech",
  "Aligner",
  "StockSearch",
  "ImageGen",
  "ClipGen",
  "Renderer",
  "Publisher",
  "BlobStore",
] as const;
