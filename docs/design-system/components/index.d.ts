// VCP — types as documentation. Global: window.VCP (React 18 components).
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";

export type StageKey = "research" | "write" | "approve-script" | "voice" | "storyboard" | "assets" | "render" | "approve-video" | "upload" | "approve-publish" | "publish";
export type StageStatus = "pending" | "running" | "waiting" | "done" | "failed";
export type ProjectStatus = "active" | "waiting" | "published" | "rejected" | "failed";
export type IdeaStatus = "new" | "shortlisted" | "selected" | "done" | "rejected";
export type ClaimStatus = "sourced" | "unsourced" | "opinion";
export type VisualKind = "stock" | "generated" | "chart" | "map" | "text" | "archive";
export type Tone = "neutral" | "muted" | "running" | "waiting" | "done" | "failed";
export type IconName = "check" | "x" | "pause" | "pending" | "running" | "dot" | "star" | "play" | "download" | "external" | "chevron" | "plus" | "search" | "restore" | "log" | "alert" | "clock" | "copy" | "arrow" | "web" | "edit";

/** One stage run. Stages you omit render as pending. */
export interface StageRun { key: StageKey; status: StageStatus; provider?: string; duration?: string; logsHref?: string; error?: string; }
export interface Evidence { quote?: string; url?: string; }
export interface Idea { id?: string; title: string; oneLiner?: string; whySurprising?: string; domain?: string; origin?: "manual" | "research"; status: IdeaStatus; score?: number | null; opinion?: boolean; evidence?: Evidence[]; }
export interface Beat { text: string; visual: VisualKind; }
export interface Claim { text: string; status: ClaimStatus; source?: string; }
export interface Script { version: number; words?: number; duration?: string; hook: string; beats: Beat[]; outro?: string; claims?: Claim[]; }
export interface StoryboardRow { beat: number; time: string; kind: VisualKind; visual: string; thumb?: string; assetStatus?: "ready" | "missing" | "failed"; assetName?: string; attribution?: string; }
export interface Project { id: string; title: string; oneLiner?: string; status: ProjectStatus; stages: StageRun[]; created: string; createdAt?: string; }
export interface MetaItem { label: string; value: ReactNode; mono?: boolean; copy?: boolean | string; }

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; icon?: IconName; iconRight?: IconName; href?: string; block?: boolean; children?: ReactNode; }
export interface IconProps { name: IconName; size?: number; stroke?: number; label?: string; className?: string; }
export interface StatusBadgeProps { kind?: "stage" | "project" | "idea" | "claim"; status: string; size?: "sm" | "md"; label?: string; bare?: boolean; }
export interface TagProps { children: ReactNode; icon?: IconName; tone?: "waiting"; title?: string; }
export interface StageStripProps { stages: StageRun[]; showLabel?: boolean; className?: string; }
export interface StageRailProps { stages: StageRun[]; className?: string; }
export interface GateBannerProps { gate: "script" | "video" | "publish"; title?: string; description?: string; approveLabel?: string; busy?: boolean; onApprove?: (opts: { scheduleAt?: string | null }) => void; onReject?: (reason: string) => void; defaultRejecting?: boolean; defaultReason?: string; defaultScheduleAt?: string; }
export interface IdeaRowProps { idea: Idea; projectHref?: string; defaultOpen?: boolean; onSelect?: () => void; onShortlist?: () => void; onReject?: () => void; onRestore?: () => void; }
export interface ProjectRowProps { project: Project; href?: string; }
export interface ProjectListProps { projects: Project[]; hrefFor?: (p: Project) => string; ideasHref?: string; empty?: ReactNode; }
export interface ProjectHeaderProps { id: string; title: string; oneLiner?: string; status: ProjectStatus; stages: StageRun[]; backHref?: string; live?: ReactNode; actions?: ReactNode; }
export interface ScriptViewProps { script: Script; editable?: boolean; defaultEditing?: boolean; onSave?: (next: Script) => void; }
export interface StoryboardTableProps { rows: StoryboardRow[]; }
export interface VerticalPreviewProps { src?: string; poster?: string; duration?: string; caption?: string; meta?: MetaItem[]; downloadHref?: string; thumbnailHref?: string; children?: ReactNode; }
export interface AudioPlayerProps { src?: string; duration: number; position?: number; title?: string; meta?: ReactNode; seed?: number; }
export interface PanelProps { title: ReactNode; meta?: ReactNode; status?: StageStatus; actions?: ReactNode; collapsible?: boolean; defaultOpen?: boolean; id?: string; children?: ReactNode; }
export interface MetaListProps { items: MetaItem[]; }
export interface NoticeProps { tone?: Tone; title?: ReactNode; icon?: IconName; role?: string; onDismiss?: () => void; children?: ReactNode; }
export interface LiveIndicatorProps { state?: "live" | "paused" | "idle"; updated?: string; }
export interface SegmentedProps { options: { value: string; label: string; count?: number }[]; value?: string; defaultValue?: string; onChange?: (v: string) => void; label?: string; }
export interface FieldProps { label: ReactNode; hint?: ReactNode; error?: ReactNode; optional?: boolean; children: ReactNode; }
export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> { label: ReactNode; hint?: ReactNode; }
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { options: (string | { value: string; label: string })[]; }
export interface EmptyStateProps { title: ReactNode; icon?: IconName; compact?: boolean; action?: ReactNode; children?: ReactNode; }
export interface TopBarProps { active?: "ideas" | "projects"; items?: { key: string; label: string; href: string; count?: number; attention?: number }[]; homeHref?: string; right?: ReactNode; }

export declare const STAGES: { key: StageKey; label: string; gate?: boolean }[];
export type InputProps = InputHTMLAttributes<HTMLInputElement>;
export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;
