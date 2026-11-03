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

export type PromptKind = "brief" | "script" | "storyboard" | "score" | "other";

export interface Prompt {
  kind: PromptKind;
  system?: string;
  user: string;
  /** Structured context the model may use; fakes key fixtures off this. */
  context?: Record<string, unknown>;
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

export interface Renderer {
  id: string;
  render(input: RenderInput): Promise<Render>;
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
