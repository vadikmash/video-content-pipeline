/* @ds-bundle: {"format":4,"namespace":"VCP","components":[{"name":"Button"},{"name":"StatusBadge"},{"name":"Tag"},{"name":"Icon"},{"name":"StageStrip"},{"name":"StageRail"},{"name":"GateBanner"},{"name":"IdeaRow"},{"name":"ProjectList"},{"name":"ProjectHeader"},{"name":"ScriptView"},{"name":"StoryboardTable"},{"name":"VerticalPreview"},{"name":"AudioPlayer"},{"name":"Panel"},{"name":"MetaList"},{"name":"Notice"},{"name":"LiveIndicator"},{"name":"Segmented"},{"name":"Field"},{"name":"EmptyState"},{"name":"TopBar"}]} */
(function () {
  "use strict";
  var React = window.React;
  var h = React.createElement, useState = React.useState, useRef = React.useRef;

  function cx() {
    var o = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) o.push(arguments[i]);
    return o.join(" ");
  }
  function omit(p, keys) {
    var o = {};
    for (var k in p) if (keys.indexOf(k) < 0) o[k] = p[k];
    return o;
  }
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return url; }
  }
  function fmtTime(s) {
    s = Math.max(0, Math.round(s || 0));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  // ---------- Icon ----------
  var ICONS = {
    check: [["path", { d: "M5 12.5l4.5 4.5L19 7.5" }]],
    x: [["path", { d: "M6.5 6.5l11 11M17.5 6.5l-11 11" }]],
    pause: [["path", { d: "M9 6.5v11M15 6.5v11" }]],
    pending: [["circle", { cx: 12, cy: 12, r: 6 }]],
    running: [["circle", { cx: 12, cy: 12, r: 6 }], ["path", { d: "M12 6a6 6 0 0 1 0 12z", fill: "currentColor", stroke: "none" }]],
    dot: [["circle", { cx: 12, cy: 12, r: 3.5, fill: "currentColor", stroke: "none" }]],
    star: [["path", { d: "M12 4.5l2.3 4.7 5.2.7-3.8 3.6.9 5.1L12 16.2l-4.6 2.4.9-5.1-3.8-3.6 5.2-.7z" }]],
    play: [["path", { d: "M8 5.5v13l10.5-6.5z", fill: "currentColor" }]],
    download: [["path", { d: "M12 4v11M7 10.5l5 5 5-5M5 20h14" }]],
    external: [["path", { d: "M14 4.5h5.5V10M19.5 4.5L11 13M18 14.5v5H4.5V6h5" }]],
    chevron: [["path", { d: "M6.5 9.5l5.5 5.5 5.5-5.5" }]],
    plus: [["path", { d: "M12 5v14M5 12h14" }]],
    search: [["circle", { cx: 11, cy: 11, r: 6.5 }], ["path", { d: "M16 16l4 4" }]],
    restore: [["path", { d: "M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5V9H9" }]],
    log: [["path", { d: "M6.5 3.5h8l4 4v13h-12zM14.5 3.5v4h4M9.5 12.5h6M9.5 16h6" }]],
    alert: [["path", { d: "M12 4l9 16H3zM12 10v4.5M12 17.2v.3" }]],
    clock: [["circle", { cx: 12, cy: 12, r: 8 }], ["path", { d: "M12 8v4.5l3 2" }]],
    copy: [["path", { d: "M9 9h10.5v10.5H9zM15 9V4.5H4.5V15H9" }]],
    arrow: [["path", { d: "M5 12h14M13 6l6 6-6 6" }]],
    web: [["circle", { cx: 12, cy: 12, r: 8 }], ["path", { d: "M4 12h16M12 4c2.4 2.4 3.5 5 3.5 8s-1.1 5.6-3.5 8c-2.4-2.4-3.5-5-3.5-8s1.1-5.6 3.5-8z" }]],
    edit: [["path", { d: "M4.5 19.5l1-4L15 6l3 3-9.5 9.5zM13 8l3 3" }]]
  };
  function Icon(p) {
    var spec = ICONS[p.name] || ICONS.dot, s = p.size || 16;
    return h("svg", {
      className: cx("vcp-icon", p.className), width: s, height: s, viewBox: "0 0 24 24",
      fill: "none", stroke: "currentColor", strokeWidth: p.stroke || 2,
      strokeLinecap: "round", strokeLinejoin: "round",
      "aria-hidden": p.label ? undefined : true, role: p.label ? "img" : undefined, "aria-label": p.label
    }, spec.map(function (e, i) { return h(e[0], Object.assign({ key: i }, e[1])); }));
  }
  Icon.names = Object.keys(ICONS);

  // ---------- Button ----------
  function Button(p) {
    var variant = p.variant || "secondary", size = p.size || "md";
    var rest = omit(p, ["variant", "size", "icon", "iconRight", "className", "children", "href", "block"]);
    var is = size === "sm" ? 14 : 16;
    var inner = [
      p.icon && h(Icon, { key: "i", name: p.icon, size: is }),
      p.children != null && h("span", { key: "t" }, p.children),
      p.iconRight && h(Icon, { key: "r", name: p.iconRight, size: is })
    ];
    var cls = cx("vcp-btn", "vcp-btn--" + variant, "vcp-btn--" + size, p.block && "vcp-btn--block", p.children == null && "vcp-btn--icon", p.className);
    if (p.href) return h("a", Object.assign({ className: cls, href: p.href }, rest), inner);
    return h("button", Object.assign({ type: "button", className: cls }, rest), inner);
  }

  // ---------- Status ----------
  var STATUS = {
    stage: { pending: ["muted", "pending", "Pending"], running: ["running", "running", "Running"], waiting: ["waiting", "pause", "Paused for you"], done: ["done", "check", "Done"], failed: ["failed", "x", "Failed"] },
    project: { active: ["running", "running", "Active"], waiting: ["waiting", "pause", "Waiting on you"], published: ["done", "check", "Published"], rejected: ["muted", "x", "Rejected"], failed: ["failed", "alert", "Failed"] },
    idea: { "new": ["neutral", "dot", "New"], shortlisted: ["neutral", "star", "Shortlisted"], selected: ["running", "arrow", "Selected"], done: ["done", "check", "Done"], rejected: ["muted", "x", "Rejected"] },
    claim: { sourced: ["done", "check", "Sourced"], unsourced: ["failed", "alert", "Unsourced"], opinion: ["waiting", "dot", "Opinion"] }
  };
  function statusOf(kind, status) {
    return (STATUS[kind] || STATUS.stage)[status] || ["neutral", "dot", String(status)];
  }
  function StatusBadge(p) {
    var s = statusOf(p.kind || "stage", p.status), sm = p.size === "sm";
    return h("span", { className: cx("vcp-status", "vcp-tone-" + s[0], sm && "vcp-status--sm", p.bare && "vcp-status--bare", p.className) },
      h(Icon, { name: s[1], size: sm ? 12 : 14, stroke: 2.25, className: s[1] === "running" ? "vcp-spin" : null }),
      h("span", null, p.label || s[2]));
  }

  function Tag(p) {
    return h("span", { className: cx("vcp-tag", p.tone && "vcp-tag--" + p.tone, p.className), title: p.title },
      p.icon && h(Icon, { name: p.icon, size: 12 }), p.children);
  }

  // ---------- Stages ----------
  var STAGES = [
    { key: "research", label: "Research" },
    { key: "write", label: "Write" },
    { key: "approve-script", label: "Approve script", gate: true },
    { key: "voice", label: "Voice" },
    { key: "storyboard", label: "Storyboard" },
    { key: "assets", label: "Assets" },
    { key: "render", label: "Render" },
    { key: "approve-video", label: "Approve video", gate: true },
    { key: "upload", label: "Upload" },
    { key: "approve-publish", label: "Approve publish", gate: true },
    { key: "publish", label: "Publish" }
  ];
  function mergeStages(stages) {
    var by = {};
    (stages || []).forEach(function (s) { by[s.key] = s; });
    return STAGES.map(function (d) { return Object.assign({}, d, { status: "pending" }, by[d.key] || {}); });
  }
  function currentIndex(list) {
    var lastDone = -1;
    for (var i = 0; i < list.length; i++) {
      var st = list[i].status;
      if (st === "running" || st === "waiting" || st === "failed") return i;
      if (st === "done") lastDone = i;
    }
    return Math.min(lastDone + 1, list.length - 1);
  }

  function StageStrip(p) {
    var list = mergeStages(p.stages), ci = currentIndex(list), cur = list[ci];
    var complete = list.every(function (s) { return s.status === "done"; });
    var word = complete ? "Published" : cur.label;
    return h("div", { className: cx("vcp-strip", p.className), role: "img", "aria-label": "Stage " + (ci + 1) + " of " + list.length + ": " + cur.label + ", " + statusOf("stage", cur.status)[2] },
      h("div", { className: "vcp-strip-bar" }, list.map(function (s, i) {
        return h("span", { key: s.key, title: s.label + " · " + statusOf("stage", s.status)[2], className: cx("vcp-strip-seg", "vcp-st-" + s.status, s.gate && "vcp-strip-seg--gate", i === ci && !complete && "is-current") });
      })),
      p.showLabel !== false && h("span", { className: "vcp-strip-label" },
        h("span", { className: "vcp-mono" }, (complete ? list.length : ci + 1) + "/" + list.length), " ", h("span", { className: cx("vcp-strip-word", "vcp-st-" + cur.status) }, word)));
  }

  function StageRail(p) {
    var list = mergeStages(p.stages);
    return h("ol", { className: cx("vcp-rail", p.className), "aria-label": "Pipeline stages" }, list.map(function (s) {
      var st = statusOf("stage", s.status);
      var meta = [s.provider, s.duration].filter(Boolean);
      return h("li", { key: s.key, className: cx("vcp-rail-step", "vcp-st-" + s.status, s.gate && "vcp-rail-step--gate") },
        h("span", { className: "vcp-rail-node" }, h(Icon, { name: st[1], size: 12, stroke: 2.5, className: s.status === "running" ? "vcp-spin" : null })),
        h("div", { className: "vcp-rail-main" },
          h("div", { className: "vcp-rail-title" },
            h("span", { className: "vcp-rail-label" }, s.label),
            h("span", { className: "vcp-sr" }, ", " + st[2]),
            s.gate && h("span", { className: "vcp-rail-gate" }, "Gate"),
            s.status === "waiting" && h("span", { className: "vcp-rail-paused", "aria-hidden": true }, "Paused for you"),
            s.status === "running" && h("span", { className: "vcp-rail-running", "aria-hidden": true }, "Running")),
          meta.length > 0 && h("div", { className: "vcp-rail-meta" }, meta.join(" · ")),
          s.error && h("div", { className: "vcp-rail-error" }, h(Icon, { name: "alert", size: 12 }), h("span", null, s.error))),
        s.logsHref && h("a", { className: "vcp-rail-logs", href: s.logsHref, "aria-label": "Run logs for " + s.label }, h(Icon, { name: "log", size: 14 }), h("span", null, "Logs")));
    }));
  }

  // ---------- Gate ----------
  var GATES = {
    script: { stage: "approve-script", title: "Script ready for review", body: "Edit the script below if needed, then approve to start voice.", cta: "Approve script" },
    video: { stage: "approve-video", title: "Render ready for review", body: "Watch the render end to end. Approving uploads it as private.", cta: "Approve video" },
    publish: { stage: "approve-publish", title: "Ready to publish", body: "Uploaded as private. Publish now, or pick a time to schedule it.", cta: "Publish" }
  };
  function GateBanner(p) {
    var g = GATES[p.gate] || GATES.script;
    var m = useState(p.defaultRejecting ? "reject" : "idle"), mode = m[0], setMode = m[1];
    var r = useState(p.defaultReason || ""), reason = r[0], setReason = r[1];
    var w = useState(p.defaultScheduleAt || ""), when = w[0], setWhen = w[1];
    var isPublish = p.gate === "publish";
    return h("section", { className: cx("vcp-gate", p.className), "aria-label": "Paused for you: " + (p.title || g.title) },
      h("div", { className: "vcp-gate-kicker" }, h(Icon, { name: "pause", size: 14, stroke: 2.5 }), h("span", null, "Paused for you"), h("span", { className: "vcp-gate-stage" }, g.stage)),
      h("div", { className: "vcp-gate-body" },
        h("div", { className: "vcp-gate-text" },
          h("h2", { className: "vcp-gate-title" }, p.title || g.title),
          h("p", { className: "vcp-gate-desc" }, p.description || g.body)),
        mode === "idle" && h("div", { className: "vcp-gate-actions" },
          isPublish && h("label", { className: "vcp-field vcp-gate-when" },
            h("span", { className: "vcp-field-label" }, "Schedule", h("span", { className: "vcp-field-opt" }, "optional")),
            h("input", { type: "datetime-local", className: "vcp-input", value: when, onChange: function (e) { setWhen(e.target.value); } })),
          h(Button, { variant: "primary", icon: "check", className: "vcp-gate-approve", disabled: p.busy, onClick: function () { if (p.onApprove) p.onApprove(isPublish ? { scheduleAt: when || null } : {}); } },
            isPublish && when ? "Schedule" : (p.approveLabel || g.cta)),
          h(Button, { variant: "ghost", onClick: function () { setMode("reject"); } }, "Reject…"))),
      mode === "reject" && h("div", { className: "vcp-gate-reject" },
        h("label", { className: "vcp-field" },
          h("span", { className: "vcp-field-label" }, "Reason for rejecting"),
          h("textarea", { className: "vcp-input vcp-textarea", rows: 2, value: reason, placeholder: "e.g. Claim in beat 3 has no primary source", onChange: function (e) { setReason(e.target.value); } }),
          h("span", { className: "vcp-field-hint" }, "The run stops here. Brief, script and assets are kept.")),
        h("div", { className: "vcp-gate-actions" },
          h(Button, { variant: "danger", icon: "x", disabled: !reason.trim(), onClick: function () { if (p.onReject) p.onReject(reason.trim()); } }, "Reject and stop"),
          h(Button, { variant: "ghost", onClick: function () { setMode("idle"); } }, "Cancel"))));
  }

  // ---------- Ideas ----------
  function IdeaRow(p) {
    var i = p.idea || {}, st = i.status || "new", ev = i.evidence || [];
    var o = useState(!!p.defaultOpen), open = o[0], setOpen = o[1];
    var actions;
    if (st === "rejected") actions = [h(Button, { key: "r", size: "sm", icon: "restore", onClick: p.onRestore }, "Restore")];
    else if (st === "selected" || st === "done") actions = [h(Button, { key: "o", size: "sm", iconRight: "arrow", href: p.projectHref || "#" }, "Open project")];
    else actions = [
      h(Button, { key: "s", size: "sm", variant: "primary", onClick: p.onSelect }, "Select"),
      st !== "shortlisted" && h(Button, { key: "l", size: "sm", icon: "star", onClick: p.onShortlist }, "Shortlist"),
      h(Button, { key: "x", size: "sm", variant: "ghost", onClick: p.onReject }, "Reject")
    ];
    var hasMore = !!(i.whySurprising || ev.length);
    return h("article", { className: cx("vcp-idea", "vcp-idea--" + st, p.className) },
      h("div", { className: "vcp-idea-inner" },
        h("div", { className: "vcp-idea-main" },
          h("div", { className: "vcp-idea-top" },
            h(StatusBadge, { kind: "idea", status: st, size: "sm" }),
            i.score != null && h("span", { className: "vcp-idea-score", title: "Score" }, "score ", h("b", null, typeof i.score === "number" ? i.score.toFixed(2) : i.score))),
          h("h3", { className: "vcp-idea-title" }, i.title),
          i.oneLiner && h("p", { className: "vcp-idea-line" }, i.oneLiner),
          h("div", { className: "vcp-idea-meta" },
            i.domain && h(Tag, null, i.domain),
            i.origin && h(Tag, { icon: i.origin === "research" ? "web" : "edit" }, i.origin),
            i.opinion && h(Tag, { tone: "waiting" }, "opinion"),
            hasMore && h("button", { type: "button", className: "vcp-link-btn", "aria-expanded": open, onClick: function () { setOpen(!open); } },
              h(Icon, { name: "chevron", size: 14, className: open ? "is-flipped" : null }),
              ev.length ? "Why · " + ev.length + " source" + (ev.length > 1 ? "s" : "") : "Why surprising")),
          open && h("div", { className: "vcp-idea-detail" },
            i.whySurprising && h("div", null, h("span", { className: "vcp-kicker" }, "Why surprising"), h("p", null, i.whySurprising)),
            ev.length > 0 && h("ul", { className: "vcp-evidence" }, ev.map(function (e, k) {
              return h("li", { key: k },
                e.quote && h("q", null, e.quote),
                e.url && h("a", { href: e.url, target: "_blank", rel: "noreferrer" }, hostOf(e.url), h(Icon, { name: "external", size: 12 })));
            })))),
        h("div", { className: "vcp-idea-actions" }, actions)));
  }

  // ---------- Projects ----------
  function ProjectRow(p) {
    var pr = p.project || {};
    return h("a", { className: cx("vcp-prow", p.className), href: p.href || "#" },
      h("div", { className: "vcp-prow-grid" },
        h("div", { className: "vcp-prow-title" },
          h("span", { className: "vcp-prow-name" }, pr.title),
          pr.oneLiner && h("span", { className: "vcp-prow-line" }, pr.oneLiner)),
        h(StageStrip, { stages: pr.stages, className: "vcp-prow-strip" }),
        h("div", { className: "vcp-prow-status" }, h(StatusBadge, { kind: "project", status: pr.status, size: "sm" })),
        h("time", { className: "vcp-prow-time", title: pr.createdAt }, pr.created)));
  }
  function ProjectList(p) {
    var items = p.projects || [];
    if (!items.length) return h("div", { className: "vcp-plist" }, p.empty || h(EmptyState, { icon: "arrow", title: "No projects yet", action: h(Button, { variant: "primary", href: p.ideasHref || "#" }, "Pick an idea") }, "A project starts when you select an idea in the inbox."));
    return h("div", { className: "vcp-plist", role: "list" },
      h("div", { className: "vcp-prow-head", "aria-hidden": true }, h("span", null, "Project"), h("span", null, "Stage"), h("span", null, "Status"), h("span", { className: "vcp-prow-time" }, "Created")),
      items.map(function (pr, k) { return h(ProjectRow, { key: pr.id || k, project: pr, href: p.hrefFor ? p.hrefFor(pr) : "#" }); }));
  }

  function ProjectHeader(p) {
    var list = mergeStages(p.stages), ci = currentIndex(list);
    return h("header", { className: cx("vcp-phead", p.className) },
      h("div", { className: "vcp-phead-crumbs" }, h("a", { href: p.backHref || "#" }, "Projects"), h("span", { "aria-hidden": true }, "/"), h("span", { className: "vcp-mono" }, p.id)),
      h("div", { className: "vcp-phead-row" },
        h("div", { className: "vcp-phead-text" },
          h("h1", { className: "vcp-phead-title" }, p.title),
          p.oneLiner && h("p", { className: "vcp-phead-line" }, p.oneLiner)),
        (p.live || p.actions) && h("div", { className: "vcp-phead-side" }, p.live, p.actions)),
      h("div", { className: "vcp-phead-status" },
        h(StatusBadge, { kind: "project", status: p.status }),
        h("span", { className: "vcp-phead-stage" }, "Stage ", h("b", null, list[ci].label), " ", h("span", { className: "vcp-mono" }, (ci + 1) + "/" + list.length)),
        h(StageStrip, { stages: p.stages, showLabel: false, className: "vcp-phead-strip" })));
  }

  // ---------- Script ----------
  var VISUAL_KINDS = ["stock", "generated", "chart", "map", "text", "archive"];
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function ScriptView(p) {
    var s = p.script || { beats: [] };
    var e = useState(p.defaultEditing ? clone(s) : null), draft = e[0], setDraft = e[1];
    if (draft) {
      var upd = function (fn) { var n = clone(draft); fn(n); setDraft(n); };
      var next = (s.version || 1) + 1;
      return h("div", { className: "vcp-script vcp-script--editing" },
        h("div", { className: "vcp-script-bar" },
          h("span", { className: "vcp-mono vcp-muted" }, "Editing v" + s.version + " → saves as v" + next),
          h("div", { className: "vcp-row" },
            h(Button, { size: "sm", variant: "ghost", onClick: function () { setDraft(null); } }, "Cancel"),
            h(Button, { size: "sm", variant: "primary", onClick: function () { if (p.onSave) p.onSave(Object.assign({}, draft, { version: next })); setDraft(null); } }, "Save v" + next))),
        h("label", { className: "vcp-field" }, h("span", { className: "vcp-kicker" }, "Hook"),
          h("textarea", { className: "vcp-input vcp-textarea", rows: 2, value: draft.hook || "", onChange: function (ev) { var v = ev.target.value; upd(function (n) { n.hook = v; }); } })),
        h("div", null, h("span", { className: "vcp-kicker" }, "Beats"),
          h("ol", { className: "vcp-beats" }, draft.beats.map(function (b, k) {
            return h("li", { key: k, className: "vcp-beat vcp-beat--edit" },
              h("span", { className: "vcp-beat-n" }, String(k + 1).padStart(2, "0")),
              h("textarea", { className: "vcp-input vcp-textarea", rows: 2, "aria-label": "Beat " + (k + 1), value: b.text, onChange: function (ev) { var v = ev.target.value; upd(function (n) { n.beats[k].text = v; }); } }),
              h("select", { className: "vcp-input vcp-select", "aria-label": "Visual kind for beat " + (k + 1), value: b.visual, onChange: function (ev) { var v = ev.target.value; upd(function (n) { n.beats[k].visual = v; }); } },
                VISUAL_KINDS.map(function (o) { return h("option", { key: o, value: o }, o); })));
          }))),
        h("label", { className: "vcp-field" }, h("span", { className: "vcp-kicker" }, "Outro"),
          h("textarea", { className: "vcp-input vcp-textarea", rows: 1, value: draft.outro || "", onChange: function (ev) { var v = ev.target.value; upd(function (n) { n.outro = v; }); } })));
    }
    var claims = s.claims || [];
    return h("div", { className: "vcp-script" },
      h("div", { className: "vcp-script-bar" },
        h("span", { className: "vcp-mono vcp-muted" }, ["v" + s.version, s.words && s.words + " words", s.duration && "~" + s.duration].filter(Boolean).join(" · ")),
        p.editable && h(Button, { size: "sm", icon: "edit", onClick: function () { setDraft(clone(s)); } }, "Edit script")),
      h("div", null, h("span", { className: "vcp-kicker" }, "Hook"), h("p", { className: "vcp-script-hook" }, s.hook)),
      h("div", null, h("span", { className: "vcp-kicker" }, "Beats"),
        h("ol", { className: "vcp-beats" }, s.beats.map(function (b, k) {
          return h("li", { key: k, className: "vcp-beat" },
            h("span", { className: "vcp-beat-n" }, String(k + 1).padStart(2, "0")),
            h("p", { className: "vcp-beat-text" }, b.text),
            h(Tag, { className: "vcp-beat-kind", title: "Visual kind" }, b.visual));
        }))),
      s.outro && h("div", null, h("span", { className: "vcp-kicker" }, "Outro"), h("p", { className: "vcp-script-outro" }, s.outro)),
      claims.length > 0 && h("div", null, h("span", { className: "vcp-kicker" }, "Claims"),
        h("ul", { className: "vcp-claims" }, claims.map(function (c, k) {
          return h("li", { key: k },
            h(StatusBadge, { kind: "claim", status: c.status, size: "sm" }),
            h("span", { className: "vcp-claim-text" }, c.text),
            c.source && h("a", { className: "vcp-claim-src", href: c.source, target: "_blank", rel: "noreferrer" }, hostOf(c.source)));
        }))));
  }

  // ---------- Storyboard ----------
  function Thumb(p) {
    var st = p.status || (p.src ? "ready" : "missing");
    return h("span", { className: cx("vcp-thumb", "vcp-thumb--" + st), title: p.title },
      p.src ? h("img", { src: p.src, alt: p.alt || "" })
        : st === "failed" ? h(Icon, { name: "alert", size: 14, label: "Asset failed" })
        : st === "ready" ? h("span", { className: "vcp-thumb-kind" }, (p.kind || "").slice(0, 3))
        : h(Icon, { name: "pending", size: 12, label: "Asset pending" }));
  }
  function StoryboardTable(p) {
    var rows = p.rows || [];
    return h("div", { className: cx("vcp-sb", p.className) },
      h("table", { className: "vcp-sb-table" },
        h("thead", null, h("tr", null, ["Beat", "Time", "Visual", "Asset", "Attribution"].map(function (t) { return h("th", { key: t, scope: "col" }, t); }))),
        h("tbody", null, rows.map(function (r, k) {
          return h("tr", { key: k, className: r.assetStatus === "failed" ? "is-failed" : null },
            h("td", { className: "vcp-sb-beat" }, String(r.beat).padStart(2, "0")),
            h("td", { className: "vcp-sb-time" }, r.time),
            h("td", { className: "vcp-sb-visual" }, h(Tag, null, r.kind), h("span", null, r.visual)),
            h("td", { className: "vcp-sb-asset" }, h(Thumb, { src: r.thumb, kind: r.kind, status: r.assetStatus, title: r.assetName })),
            h("td", { className: "vcp-sb-attr" }, r.attribution || h("span", { className: "vcp-faint" }, "—")));
        }))));
  }

  // ---------- Media ----------
  function MetaList(p) {
    var items = p.items || [];
    return h("dl", { className: cx("vcp-meta", p.className) }, items.map(function (it, k) {
      return [
        h("dt", { key: "t" + k }, it.label),
        h("dd", { key: "d" + k, className: it.mono ? "is-mono" : null }, it.value,
          it.copy && h("button", { type: "button", className: "vcp-copy", "aria-label": "Copy " + it.label, onClick: function () { try { navigator.clipboard.writeText(String(it.copy === true ? it.value : it.copy)); } catch (e) {} } }, h(Icon, { name: "copy", size: 13 })))
      ];
    }));
  }

  function VerticalPreview(p) {
    return h("div", { className: cx("vcp-vp", p.className) },
      h("div", { className: "vcp-vp-inner" },
        h("div", { className: "vcp-vp-frame" },
          p.src ? h("video", { src: p.src, poster: p.poster, controls: true, playsInline: true, preload: "metadata" })
            : h("div", { className: "vcp-vp-placeholder" },
              p.duration && h("span", { className: "vcp-vp-dur" }, p.duration),
              h("span", { className: "vcp-vp-play" }, h(Icon, { name: "play", size: 20, label: "Play preview" })),
              p.caption && h("span", { className: "vcp-vp-caption" }, p.caption))),
        h("div", { className: "vcp-vp-side" },
          h(MetaList, { items: p.meta || [] }),
          h("div", { className: "vcp-row" },
            h(Button, { icon: "download", href: p.downloadHref || "#", download: "" }, "Download MP4"),
            p.thumbnailHref && h(Button, { variant: "ghost", icon: "download", href: p.thumbnailHref, download: "" }, "Thumbnail")),
          p.children)));
  }

  function AudioPlayer(p) {
    var pl = useState(false), playing = pl[0], setPlaying = pl[1];
    var ps = useState(p.position || 0), pos = ps[0], setPos = ps[1];
    var ref = useRef(null), dur = p.duration || 0;
    var bars = [], seed = p.seed || 7;
    for (var i = 0; i < 64; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      bars.push(0.18 + 0.5 * Math.abs(Math.sin(i * 0.37)) + 0.32 * (seed / 233280));
    }
    var progress = dur ? pos / dur : 0;
    function toggle() {
      var a = ref.current;
      if (a) { if (a.paused) a.play(); else a.pause(); } else setPlaying(!playing);
    }
    function seek(e) {
      var r = e.currentTarget.getBoundingClientRect(), t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur;
      if (ref.current) ref.current.currentTime = t;
      setPos(t);
    }
    return h("div", { className: cx("vcp-audio", p.className) },
      p.src && h("audio", { ref: ref, src: p.src, preload: "metadata", onTimeUpdate: function (e) { setPos(e.target.currentTime); }, onPlay: function () { setPlaying(true); }, onPause: function () { setPlaying(false); } }),
      h("button", { type: "button", className: "vcp-audio-play", "aria-label": playing ? "Pause narration" : "Play narration", onClick: toggle }, h(Icon, { name: playing ? "pause" : "play", size: 16, stroke: 2.5 })),
      h("div", { className: "vcp-audio-body" },
        h("div", { className: "vcp-audio-head" },
          h("span", { className: "vcp-audio-title" }, p.title || "Narration"),
          h("span", { className: "vcp-mono vcp-muted" }, fmtTime(pos) + " / " + fmtTime(dur))),
        h("div", { className: "vcp-wave", role: "slider", tabIndex: 0, "aria-label": "Seek", "aria-valuemin": 0, "aria-valuemax": Math.round(dur), "aria-valuenow": Math.round(pos), onClick: seek },
          bars.map(function (b, k) { return h("span", { key: k, className: k / bars.length < progress ? "is-played" : null, style: { height: Math.round(b * 100) + "%" } }); })),
        p.meta && h("div", { className: "vcp-audio-meta" }, p.meta)));
  }

  // ---------- Layout & feedback ----------
  function Panel(p) {
    var head = [
      h("div", { key: "t", className: "vcp-panel-titles" },
        h("h2", { className: "vcp-panel-title" }, p.title),
        p.meta && h("span", { className: "vcp-panel-meta" }, p.meta)),
      p.status && h(StatusBadge, { key: "s", status: p.status, size: "sm" }),
      p.actions && h("div", { key: "a", className: "vcp-panel-actions" }, p.actions)
    ];
    if (p.collapsible) {
      return h("details", { className: cx("vcp-panel", p.className), id: p.id, open: p.defaultOpen },
        h("summary", { className: "vcp-panel-head" }, h(Icon, { name: "chevron", size: 16, className: "vcp-panel-chev" }), head),
        h("div", { className: "vcp-panel-body" }, p.children));
    }
    return h("section", { className: cx("vcp-panel", p.className), id: p.id },
      h("div", { className: "vcp-panel-head" }, head),
      h("div", { className: "vcp-panel-body" }, p.children));
  }

  function Notice(p) {
    var tone = p.tone || "neutral";
    var icon = p.icon || { done: "check", failed: "alert", waiting: "pause", running: "running" }[tone] || "dot";
    return h("div", { className: cx("vcp-notice", "vcp-tone-" + tone, p.className), role: p.role || "status" },
      h(Icon, { name: icon, size: 16 }),
      h("div", { className: "vcp-notice-body" }, p.title && h("strong", null, p.title), p.children && h("span", null, p.children)),
      p.onDismiss && h("button", { type: "button", className: "vcp-notice-x", "aria-label": "Dismiss", onClick: p.onDismiss }, h(Icon, { name: "x", size: 14 })));
  }

  function LiveIndicator(p) {
    var state = p.state || "live";
    var word = { live: "Live", paused: "Paused", idle: "Not polling" }[state];
    return h("span", { className: cx("vcp-live", "vcp-live--" + state, p.className), role: "status" },
      h("span", { className: "vcp-live-dot", "aria-hidden": true }), h("span", null, word),
      p.updated && h("span", { className: "vcp-live-ago" }, p.updated));
  }

  function Segmented(p) {
    var opts = p.options || [];
    var s = useState(p.defaultValue != null ? p.defaultValue : (opts[0] && opts[0].value)), inner = s[0], setInner = s[1];
    var val = p.value != null ? p.value : inner;
    return h("div", { className: cx("vcp-segmented", p.className), role: "tablist", "aria-label": p.label },
      opts.map(function (o) {
        var on = val === o.value;
        return h("button", { key: o.value, type: "button", role: "tab", "aria-selected": on, className: cx("vcp-segmented-opt", on && "is-active"), onClick: function () { setInner(o.value); if (p.onChange) p.onChange(o.value); } },
          h("span", null, o.label), o.count != null && h("span", { className: "vcp-segmented-count" }, o.count));
      }));
  }

  function Field(p) {
    return h("label", { className: cx("vcp-field", p.className) },
      h("span", { className: "vcp-field-label" }, p.label, p.optional && h("span", { className: "vcp-field-opt" }, "optional")),
      p.children,
      p.hint && !p.error && h("span", { className: "vcp-field-hint" }, p.hint),
      p.error && h("span", { className: "vcp-field-error" }, h(Icon, { name: "alert", size: 12 }), p.error));
  }
  function Input(p) { return h("input", Object.assign({}, p, { className: cx("vcp-input", p.className) })); }
  function Textarea(p) { return h("textarea", Object.assign({ rows: 3 }, p, { className: cx("vcp-input vcp-textarea", p.className) })); }
  function Select(p) {
    return h("select", Object.assign({}, omit(p, ["options"]), { className: cx("vcp-input vcp-select", p.className) }),
      (p.options || []).map(function (x) { return typeof x === "string" ? h("option", { key: x, value: x }, x) : h("option", { key: x.value, value: x.value }, x.label); }));
  }
  function Checkbox(p) {
    return h("label", { className: cx("vcp-check", p.className) },
      h("input", Object.assign({ type: "checkbox" }, omit(p, ["label", "hint", "className"]))),
      h("span", { className: "vcp-check-box", "aria-hidden": true }, h(Icon, { name: "check", size: 12, stroke: 3 })),
      h("span", { className: "vcp-check-text" }, h("span", null, p.label), p.hint && h("span", { className: "vcp-field-hint" }, p.hint)));
  }

  function EmptyState(p) {
    return h("div", { className: cx("vcp-empty", p.compact && "vcp-empty--compact", p.className) },
      p.icon && h("span", { className: "vcp-empty-icon" }, h(Icon, { name: p.icon, size: p.compact ? 16 : 20 })),
      h("div", { className: "vcp-empty-text" },
        h("p", { className: "vcp-empty-title" }, p.title),
        p.children && h("p", { className: "vcp-empty-body" }, p.children)),
      p.action);
  }

  function TopBar(p) {
    var items = p.items || [{ key: "ideas", label: "Ideas", href: "#/ideas" }, { key: "projects", label: "Projects", href: "#/projects" }];
    return h("header", { className: cx("vcp-top", p.className) },
      h("a", { className: "vcp-top-brand", href: p.homeHref || "#" }, h("span", { className: "vcp-top-mark" }, "VCP"), h("span", { className: "vcp-top-sub" }, "pipeline")),
      h("nav", { className: "vcp-top-nav", "aria-label": "Main" }, items.map(function (it) {
        var on = p.active === it.key;
        return h("a", { key: it.key, href: it.href, className: cx("vcp-top-link", on && "is-active"), "aria-current": on ? "page" : undefined },
          it.label,
          it.attention ? h("span", { className: "vcp-top-attn", title: it.attention + " waiting on you" }, it.attention)
            : it.count != null && h("span", { className: "vcp-top-count" }, it.count));
      })),
      p.right && h("div", { className: "vcp-top-right" }, p.right));
  }

  // ---------- Sample data (fixtures for previews and tests) ----------
  function st(list) { return list.map(function (x) { return { key: x[0], status: x[1], provider: x[2], duration: x[3], logsHref: x[1] !== "pending" ? "#logs/" + x[0] : undefined, error: x[4] }; }); }
  var W = "https://en.wikipedia.org/wiki/";
  var sample = {
    ideas: [
      { id: "i_301", title: "A day on Venus is longer than its year", oneLiner: "Venus turns once every 243 Earth days but orbits the Sun in 225.", whySurprising: "Most people assume a planet's day is always far shorter than its year, as on Earth.", domain: "space", origin: "research", status: "selected", score: 0.88, evidence: [{ quote: "Venus has the longest rotation period of any planet in the Solar System.", url: W + "Venus" }], projectHref: "#/projects/p_0142" },
      { id: "i_302", title: "Oxford University is older than the Aztec Empire", oneLiner: "Teaching at Oxford existed by 1096; Tenochtitlan was founded in 1325.", whySurprising: "Medieval Europe and the Aztecs feel like different eras, but Oxford predates the Aztec capital by two centuries.", domain: "history", origin: "research", status: "shortlisted", score: 0.91, evidence: [{ quote: "There is evidence of teaching as early as 1096.", url: W + "University_of_Oxford" }, { url: W + "Tenochtitlan" }] },
      { id: "i_303", title: "Sharks are older than trees", oneLiner: "Sharks appear in the fossil record about 50 million years before the first trees.", whySurprising: "Trees feel ancient and permanent; sharks feel modern.", domain: "nature", origin: "research", status: "new", score: 0.86, evidence: [{ url: W + "Shark" }, { url: W + "Archaeopteris" }] },
      { id: "i_304", title: "Bananas are slightly radioactive", oneLiner: "They contain potassium-40, a naturally radioactive isotope.", whySurprising: "Food and radiation feel mutually exclusive.", domain: "science", origin: "research", status: "new", score: 0.78, evidence: [{ url: W + "Banana_equivalent_dose" }] },
      { id: "i_305", title: "The Eiffel Tower grows about 15 cm in summer", oneLiner: "Thermal expansion of the iron makes it taller on hot days.", domain: "engineering", origin: "manual", status: "new", score: null, evidence: [] },
      { id: "i_306", title: "Honey found in Egyptian tombs was still edible", oneLiner: "Archaeologists have found pots of honey thousands of years old that never spoiled.", domain: "history", origin: "manual", status: "done", score: 0.83, evidence: [{ url: W + "Honey" }], projectHref: "#/projects/p_0139" },
      { id: "i_307", title: "Scotland's national animal is the unicorn", oneLiner: "It has been a Scottish heraldic symbol since the 12th century.", domain: "culture", origin: "research", status: "rejected", score: 0.52, opinion: true, evidence: [{ url: W + "Unicorn" }] }
    ],
    stages: {
      script: st([["research", "done", "claude · web", "1m 12s"], ["write", "done", "claude", "38s"], ["approve-script", "waiting"]]),
      video: st([["research", "done", "claude · web", "58s"], ["write", "done", "claude", "41s"], ["approve-script", "done", "you", "6m"], ["voice", "done", "elevenlabs", "22s"], ["storyboard", "done", "claude", "17s"], ["assets", "done", "pexels · flux", "2m 03s"], ["render", "done", "ffmpeg", "1m 54s"], ["approve-video", "waiting"]]),
      running: st([["research", "done", "claude · web", "1m 31s"], ["write", "done", "claude", "44s"], ["approve-script", "done", "you", "12m"], ["voice", "done", "elevenlabs", "19s"], ["storyboard", "running", "claude", "9s"]]),
      failed: st([["research", "done", "claude · web", "1m 05s"], ["write", "done", "claude", "35s"], ["approve-script", "done", "you", "3m"], ["voice", "done", "elevenlabs", "24s"], ["storyboard", "done", "claude", "15s"], ["assets", "failed", "pexels", "48s", "pexels: 0 results for \"devonian forest\" (beat 4) after 3 retries"]]),
      published: st(STAGES.map(function (s, i) { return [s.key, "done", s.gate ? "you" : ["claude · web", "claude", "", "elevenlabs", "claude", "pexels", "ffmpeg", "", "youtube", "", "youtube"][i], ["1m 02s", "40s", "4m", "21s", "16s", "1m 47s", "1m 49s", "9m", "34s", "2h", "3s"][i]]; })),
      rejected: st([["research", "done", "claude · web", "1m 20s"], ["write", "done", "claude", "39s"], ["approve-script", "failed", "you", "2m", "Rejected: claim about 12th-century adoption has no primary source"]])
    },
    scripts: {
      venus: { version: 2, words: 72, duration: "32s", hook: "Venus spins so slowly that its day outlasts its year.", beats: [
        { text: "Venus takes 243 Earth days to turn once on its axis.", visual: "chart" },
        { text: "But it orbits the Sun in just 225.", visual: "chart" },
        { text: "So one Venusian day is longer than a Venusian year.", visual: "text" },
        { text: "And it spins backwards: the Sun rises in the west.", visual: "generated" },
        { text: "Scientists still argue why: a giant impact, or its thick atmosphere dragging on it.", visual: "archive" }
      ], outro: "Follow for one surprising fact a day.", claims: [
        { text: "Sidereal rotation is about 243 Earth days", status: "sourced", source: W + "Venus" },
        { text: "Orbital period is about 225 Earth days", status: "sourced", source: W + "Venus" },
        { text: "Rotation is retrograde", status: "sourced", source: W + "Venus" },
        { text: "The cause of retrograde rotation is debated", status: "unsourced" }
      ] },
      honey: { version: 3, words: 88, duration: "41s", hook: "Archaeologists opened a 3,000-year-old jar of honey. It was still edible.", beats: [
        { text: "Honey has been found in Egyptian tombs, sealed for thousands of years.", visual: "archive" },
        { text: "It's so low in water that bacteria can't survive in it.", visual: "generated" },
        { text: "It's also acidic, around pH 3.9.", visual: "chart" },
        { text: "And bees add an enzyme that slowly releases hydrogen peroxide.", visual: "stock" },
        { text: "Sealed from moisture, it simply doesn't spoil.", visual: "stock" },
        { text: "It may crystallise, but warm it and it's honey again.", visual: "stock" }
      ], outro: "Follow for one surprising fact a day.", claims: [
        { text: "Edible honey found in ancient Egyptian tombs", status: "sourced", source: W + "Honey" },
        { text: "Average pH around 3.9", status: "sourced", source: W + "Honey" },
        { text: "Glucose oxidase produces hydrogen peroxide", status: "sourced", source: W + "Glucose_oxidase" }
      ] }
    },
    storyboard: [
      { beat: 0, time: "0:00–0:04", kind: "archive", visual: "Tomb interior, sealed amphora", assetStatus: "ready", attribution: "Wikimedia Commons · CC BY-SA 4.0" },
      { beat: 1, time: "0:04–0:10", kind: "archive", visual: "Hieroglyph wall panel, slow push-in", assetStatus: "ready", attribution: "The Met · Open Access" },
      { beat: 2, time: "0:10–0:16", kind: "generated", visual: "Macro honey drip, bacteria fading", assetStatus: "ready", attribution: "Generated · flux" },
      { beat: 3, time: "0:16–0:21", kind: "chart", visual: "pH scale, marker at 3.9", assetStatus: "ready", attribution: "Rendered in-house" },
      { beat: 4, time: "0:21–0:28", kind: "stock", visual: "Bee on comb, close-up", assetStatus: "ready", attribution: "Pexels · Pexels License" },
      { beat: 5, time: "0:28–0:34", kind: "stock", visual: "Jar lid sealing", assetStatus: "ready", attribution: "Pexels · Pexels License" },
      { beat: 6, time: "0:34–0:41", kind: "stock", visual: "Crystallised honey melting in warm water", assetStatus: "ready", attribution: "Pexels · Pexels License" }
    ]
  };
  sample.projects = [
    { id: "p_0142", title: sample.ideas[0].title, oneLiner: sample.ideas[0].oneLiner, status: "waiting", stages: sample.stages.script, created: "12m ago", createdAt: "2026-11-03 14:22" },
    { id: "p_0139", title: "Honey found in Egyptian tombs was still edible", oneLiner: sample.ideas[5].oneLiner, status: "waiting", stages: sample.stages.video, created: "3h ago", createdAt: "2026-11-03 11:40" },
    { id: "p_0141", title: "Octopuses have three hearts", oneLiner: "Two pump blood through the gills; the third stops when they swim.", status: "active", stages: sample.stages.running, created: "41m ago", createdAt: "2026-11-03 13:53" },
    { id: "p_0137", title: "Sharks are older than trees", oneLiner: "Sharks predate the first trees by about 50 million years.", status: "failed", stages: sample.stages.failed, created: "yesterday", createdAt: "2026-11-02 18:05" },
    { id: "p_0131", title: "Wombats produce cube-shaped droppings", oneLiner: "Their intestines have varying elasticity that shapes the faeces.", status: "published", stages: sample.stages.published, created: "Oct 29", createdAt: "2026-10-29 09:12" },
    { id: "p_0128", title: "Scotland's national animal is the unicorn", oneLiner: sample.ideas[6].oneLiner, status: "rejected", stages: sample.stages.rejected, created: "Oct 27", createdAt: "2026-10-27 16:30" }
  ];

  var api = {
    Icon: Icon, Button: Button, StatusBadge: StatusBadge, Tag: Tag,
    StageStrip: StageStrip, StageRail: StageRail, GateBanner: GateBanner,
    IdeaRow: IdeaRow, ProjectRow: ProjectRow, ProjectList: ProjectList, ProjectHeader: ProjectHeader,
    ScriptView: ScriptView, StoryboardTable: StoryboardTable, Thumb: Thumb,
    VerticalPreview: VerticalPreview, AudioPlayer: AudioPlayer,
    Panel: Panel, MetaList: MetaList, Notice: Notice, LiveIndicator: LiveIndicator,
    Segmented: Segmented, Field: Field, Input: Input, Textarea: Textarea, Select: Select, Checkbox: Checkbox,
    EmptyState: EmptyState, TopBar: TopBar,
    STAGES: STAGES, VISUAL_KINDS: VISUAL_KINDS, STATUS: STATUS, mergeStages: mergeStages, currentIndex: currentIndex,
    sample: sample
  };
  window.VCP = Object.assign(window.VCP || {}, api);
})();
