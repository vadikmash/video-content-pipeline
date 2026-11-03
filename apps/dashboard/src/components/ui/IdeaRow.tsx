import type { Idea } from "@vcp/core";
import { Button } from "./Button";
import { absoluteTime, cx, hostOf, relativeTime } from "./format";
import { Icon } from "./Icon";
import { IdeaWhy } from "./IdeaWhy";
import { StatusBadge } from "./StatusBadge";
import { Tag } from "./Tag";

type Action = () => Promise<void>;

export interface IdeaRowProps {
  idea: Idea;
  projectHref?: string;
  actions: { select: Action; shortlist: Action; reject: Action; restore: Action };
  defaultOpen?: boolean;
}

function IdeaActions({ idea, projectHref, actions }: Omit<IdeaRowProps, "defaultOpen">) {
  if (idea.status === "rejected") {
    return (
      <form action={actions.restore}>
        <Button size="sm" icon="restore">
          Restore
        </Button>
      </form>
    );
  }
  if (idea.status === "selected" || idea.status === "done") {
    return (
      <Button size="sm" iconRight="arrow" href={projectHref ?? "/projects"}>
        Open project
      </Button>
    );
  }
  return (
    <>
      <form action={actions.select}>
        <Button size="sm" variant="primary">
          Select
        </Button>
      </form>
      {idea.status !== "shortlisted" ? (
        <form action={actions.shortlist}>
          <Button size="sm" icon="star">
            Shortlist
          </Button>
        </form>
      ) : null}
      <form action={actions.reject}>
        <Button size="sm" variant="ghost">
          Reject
        </Button>
      </form>
    </>
  );
}

export function IdeaRow({ idea, projectHref, actions, defaultOpen }: IdeaRowProps) {
  const ev = idea.evidence;
  const label = ev.length ? `Why · ${ev.length} source${ev.length > 1 ? "s" : ""}` : "Why surprising";
  const detail = (
    <>
      <div>
        <span className="vcp-kicker">Why surprising</span>
        <p>{idea.whySurprising}</p>
      </div>
      {ev.length > 0 ? (
        <ul className="vcp-evidence">
          {ev.map((e, k) => (
            <li key={k}>
              <q>{e.quote}</q>
              <a href={e.url} target="_blank" rel="noreferrer">
                {hostOf(e.url)}
                <Icon name="external" size={12} />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );

  return (
    <article className={cx("vcp-idea", `vcp-idea--${idea.status}`)}>
      <div className="vcp-idea-inner">
        <div className="vcp-idea-main">
          <div className="vcp-idea-top">
            <StatusBadge kind="idea" status={idea.status} size="sm" />
            {idea.score != null ? (
              <span className="vcp-idea-score" title="Score">
                score <b>{idea.score.toFixed(2)}</b>
              </span>
            ) : null}
            <time className="vcp-idea-time" dateTime={idea.createdAt} title={absoluteTime(idea.createdAt)}>
              {relativeTime(idea.createdAt)}
            </time>
          </div>
          <h3 className="vcp-idea-title">{idea.title}</h3>
          <p className="vcp-idea-line">{idea.oneLiner}</p>
          <IdeaWhy
            defaultOpen={defaultOpen}
            label={label}
            detail={detail}
            tags={
              <>
                <Tag>{idea.domain}</Tag>
                <Tag icon={idea.origin === "research" ? "web" : "edit"}>{idea.origin}</Tag>
                {idea.opinion ? <Tag tone="waiting">opinion</Tag> : null}
              </>
            }
          />
        </div>
        <div className="vcp-idea-actions">
          <IdeaActions idea={idea} projectHref={projectHref} actions={actions} />
        </div>
      </div>
    </article>
  );
}
