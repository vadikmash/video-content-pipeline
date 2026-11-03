import { Domain, type IdeaStatus } from "@vcp/core";
import { listIdeas } from "@vcp/db";
import { AutoSubmitSelect } from "@/components/ui/AutoSubmitSelect";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { IdeaRow } from "@/components/ui/IdeaRow";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Segmented";
import { addIdea, discoverIdeas, rejectIdea, restoreIdea, selectIdea, shortlistIdea } from "./actions";

export const dynamic = "force-dynamic";

type Search = {
  status?: string;
  domain?: string;
  origin?: string;
  sourced?: string;
  skipped?: string;
  via?: string;
  add?: string;
};

const STATUS_FILTERS: IdeaStatus[] = ["new", "shortlisted", "selected", "done", "rejected"];

function ideasHref(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/ideas?${s}` : "/ideas";
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function IdeasPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const all = await listIdeas({ domain: sp.domain, origin: sp.origin });
  const ideas = sp.status ? all.filter((i) => i.status === sp.status) : all;
  const counts = new Map<string, number>();
  for (const i of all) counts.set(i.status, (counts.get(i.status) ?? 0) + 1);

  const filters = { status: sp.status, domain: sp.domain, origin: sp.origin };
  const sourced = sp.sourced ? Number(sp.sourced) : null;
  const skipped = sp.skipped ? Number(sp.skipped) : 0;
  const adding = sp.add === "1";

  const sourceButton = (
    <form action={discoverIdeas}>
      <Button variant="primary" icon="web">
        Source from web
      </Button>
    </form>
  );

  return (
    <>
      <div className="vcp-page-head">
        <div>
          <h1 className="vcp-page-title">Ideas</h1>
          <p className="vcp-page-sub">Candidate facts. Select one to start a project.</p>
        </div>
        <div className="vcp-row">
          <Button icon="plus" href={ideasHref({ ...filters, add: adding ? undefined : "1" })}>
            Add idea
          </Button>
          {sourceButton}
        </div>
      </div>

      {sourced !== null || adding ? (
        <div className="vcp-stack vcp-ideas-above">
          {sourced !== null ? (
            <Notice
              tone="done"
              title={`Sourced ${sourced + skipped} idea${sourced + skipped === 1 ? "" : "s"}`}
              dismissHref={ideasHref({ ...filters, add: sp.add })}
            >
              {sourced} added · {skipped} skipped as duplicates · via <span className="vcp-mono">{sp.via ?? "IdeaSource"}</span>
            </Notice>
          ) : null}
          {adding ? (
            <Panel
              title="Add idea"
              actions={
                <Button size="sm" variant="ghost" href={ideasHref(filters)}>
                  Cancel
                </Button>
              }
            >
              <form action={addIdea} className="vcp-add-idea">
                <Field label="Title">
                  <Input name="title" required placeholder="Australia lost a war against emus" />
                </Field>
                <Field label="Domain">
                  <Select name="domain" defaultValue="history" options={[...Domain.options]} />
                </Field>
                <Field label="One-liner">
                  <Input
                    name="oneLiner"
                    required
                    placeholder="In 1932 the army deployed machine guns against emus and withdrew."
                  />
                </Field>
                <Field label="Why surprising">
                  <Input name="whySurprising" required placeholder="A modern military outmanoeuvred by flightless birds." />
                </Field>
                <Field label="Evidence URL" optional>
                  <Input name="evidenceUrl" type="url" placeholder="https://en.wikipedia.org/wiki/Great_Emu_War" />
                </Field>
                <Field label="Evidence quote" optional hint="Verbatim from the source.">
                  <Textarea name="evidenceQuote" rows={2} />
                </Field>
                <div className="vcp-add-idea-foot">
                  <Checkbox name="opinion" label="This is an opinion" hint="Skips the second-source rule." />
                  <Button variant="primary" icon="plus">
                    Add to inbox
                  </Button>
                </div>
              </form>
            </Panel>
          ) : null}
        </div>
      ) : null}

      <div className="vcp-toolbar">
        <Segmented
          label="Status"
          value={sp.status ?? "all"}
          options={[
            { value: "all", label: "All", count: all.length, href: ideasHref({ ...filters, status: undefined }) },
            ...STATUS_FILTERS.map((s) => ({
              value: s,
              label: capitalize(s),
              count: counts.get(s) ?? 0,
              href: ideasHref({ ...filters, status: s }),
            })),
          ]}
        />
        <form method="get" action="/ideas" className="vcp-row">
          {sp.status ? <input type="hidden" name="status" value={sp.status} /> : null}
          <AutoSubmitSelect
            name="domain"
            aria-label="Domain"
            defaultValue={sp.domain ?? ""}
            options={[{ value: "", label: "All domains" }, ...Domain.options]}
          />
          <AutoSubmitSelect
            name="origin"
            aria-label="Origin"
            defaultValue={sp.origin ?? ""}
            options={[{ value: "", label: "Any origin" }, "research", "manual"]}
          />
          <noscript>
            <Button size="sm">Apply</Button>
          </noscript>
        </form>
      </div>

      {ideas.length === 0 ? (
        <div className="vcp-list">
          {all.length === 0 && !sp.domain && !sp.origin ? (
            <EmptyState
              icon="search"
              title="Inbox is empty"
              action={
                <div className="vcp-row">
                  {sourceButton}
                  <Button icon="plus" href={ideasHref({ add: "1" })}>
                    Add idea
                  </Button>
                </div>
              }
            >
              Source candidate facts from the web, or add one by hand.
            </EmptyState>
          ) : (
            <EmptyState
              icon="search"
              title="No ideas match"
              action={<Button href="/ideas">Clear filters</Button>}
            >
              Try another status, domain or origin.
            </EmptyState>
          )}
        </div>
      ) : (
        <div className="vcp-list">
          {ideas.map((idea) => (
            <IdeaRow
              key={idea.id}
              idea={idea}
              projectHref={`/projects?idea=${idea.id}`}
              actions={{
                select: selectIdea.bind(null, idea.id, false),
                shortlist: shortlistIdea.bind(null, idea.id),
                reject: rejectIdea.bind(null, idea.id),
                restore: restoreIdea.bind(null, idea.id),
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
