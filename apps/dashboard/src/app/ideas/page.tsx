import { Domain, IdeaStatus, type Idea } from "@vcp/core";
import { listIdeas } from "@vcp/db";
import Link from "next/link";
import { addIdea, discoverIdeas, rejectIdea, restoreIdea, selectIdea, shortlistIdea } from "./actions";

export const dynamic = "force-dynamic";

type Search = { status?: string; domain?: string; origin?: string; sourced?: string; skipped?: string; via?: string };

const STATUS_CLASS: Record<Idea["status"], string> = {
  new: "",
  shortlisted: "info",
  selected: "accent",
  rejected: "bad",
  done: "ok",
};

export default async function IdeasPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const ideas = await listIdeas({ status: sp.status, domain: sp.domain, origin: sp.origin });
  const sourced = sp.sourced ? Number(sp.sourced) : null;

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Ideas</h1>
        <form action={discoverIdeas}>
          <button type="submit" className="primary">
            Source from web
          </button>
        </form>
      </div>
      {sourced !== null ? (
        <div className="panel" style={{ borderColor: "var(--ok)" }}>
          Discovery via <code>{sp.via ?? "IdeaSource"}</code>: added <strong>{sourced}</strong>
          {sp.skipped ? <> · skipped {sp.skipped} duplicates</> : null}. Select the ones you want below.
        </div>
      ) : null}

      <div className="grid2">
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Inbox</h2>
          <form method="get" className="row" style={{ marginBottom: 12 }}>
            <select name="status" defaultValue={sp.status ?? ""} style={{ width: 160 }}>
              <option value="">any status</option>
              {IdeaStatus.options.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select name="domain" defaultValue={sp.domain ?? ""} style={{ width: 160 }}>
              <option value="">any domain</option>
              {Domain.options.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select name="origin" defaultValue={sp.origin ?? ""} style={{ width: 140 }}>
              <option value="">any origin</option>
              <option value="manual">manual</option>
              <option value="research">research</option>
            </select>
            <button type="submit">Filter</button>
            <Link href="/ideas" className="small">
              clear
            </Link>
          </form>

          {ideas.length === 0 ? (
            <p className="muted">No ideas match. Add one on the right.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Idea</th>
                  <th>Domain</th>
                  <th>Origin</th>
                  <th>Evidence</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ideas.map((idea) => (
                  <tr key={idea.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{idea.title}</div>
                      <div className="muted small">{idea.oneLiner}</div>
                      {idea.score !== undefined ? <div className="small">score {idea.score.toFixed(2)}</div> : null}
                    </td>
                    <td>{idea.domain}</td>
                    <td>
                      {idea.origin}
                      {idea.opinion ? <span className="badge" style={{ marginLeft: 6 }}>opinion</span> : null}
                    </td>
                    <td>
                      {idea.evidence.length}
                      {idea.sourceUrl ? (
                        <>
                          {" "}
                          <a href={idea.sourceUrl} target="_blank" rel="noreferrer" className="small">
                            source
                          </a>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_CLASS[idea.status]}`}>{idea.status}</span>
                    </td>
                    <td>
                      <IdeaActions idea={idea} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Add idea</h2>
          <form action={addIdea}>
            <label>Title</label>
            <input name="title" required placeholder="Australia lost a war against emus" />
            <label>One-liner</label>
            <input name="oneLiner" required placeholder="In 1932 the army deployed machine guns against emus and withdrew." />
            <label>Why surprising</label>
            <textarea name="whySurprising" required rows={2} placeholder="A modern military outmanoeuvred by flightless birds." />
            <label>Domain</label>
            <select name="domain" defaultValue="history">
              {Domain.options.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <label>Evidence URL (optional)</label>
            <input name="evidenceUrl" type="url" placeholder="https://en.wikipedia.org/wiki/Great_Emu_War" />
            <label>Evidence quote (optional, verbatim)</label>
            <textarea name="evidenceQuote" rows={2} />
            <label className="row" style={{ marginTop: 12 }}>
              <input type="checkbox" name="opinion" style={{ width: "auto" }} /> opinion piece (skips the second-source rule)
            </label>
            <div style={{ marginTop: 12 }}>
              <button className="primary" type="submit">
                Add
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

function IdeaActions({ idea }: { idea: Idea }) {
  const select = selectIdea.bind(null, idea.id, false);
  const shortlist = shortlistIdea.bind(null, idea.id);
  const reject = rejectIdea.bind(null, idea.id);
  const restore = restoreIdea.bind(null, idea.id);

  if (idea.status === "selected" || idea.status === "done") {
    return (
      <Link href={`/projects?idea=${idea.id}`} className="small">
        project
      </Link>
    );
  }
  if (idea.status === "rejected") {
    return (
      <form action={restore} className="inline">
        <button type="submit">Restore</button>
      </form>
    );
  }
  return (
    <div className="row">
      <form action={select} className="inline">
        <button type="submit" className="primary">
          Select
        </button>
      </form>
      {idea.status !== "shortlisted" ? (
        <form action={shortlist} className="inline">
          <button type="submit">Shortlist</button>
        </form>
      ) : null}
      <form action={reject} className="inline">
        <button type="submit" className="danger">
          Reject
        </button>
      </form>
    </div>
  );
}
