import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Globe2,
  LoaderCircle,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Sun,
  UserRound,
  X,
  Archive,
  Square,
  Paperclip,
  ExternalLink,
  Clock3,
  RefreshCw,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  api,
  ApiError,
  download,
  errorText,
  statusLabels,
  kindLabels,
} from "./api";
import type {
  Artifact,
  Bootstrap,
  Catalog,
  Conversation,
  Job,
  Profile,
  Settings,
} from "./api";

const emptyJob = {
  title: "",
  company: "",
  location: "",
  url: "",
  description: "",
  deadline: "",
  source: "manual",
};
type JobForm = typeof emptyJob;
function currentRoute() {
  return location.hash.slice(1) || "/";
}
function go(path: string) {
  location.hash = path;
}
function shortDate(value: string) {
  return new Date(
    value.length === 10 ? value + "T12:00:00" : value,
  ).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function Spinner() {
  return <LoaderCircle className="spin" size={17} />;
}
function Tag({ status }: { status: string }) {
  return (
    <span className={"job-tag " + status}>
      {statusLabels[status] || status}
    </span>
  );
}
function Text({ children }: { children: string }) {
  return (
    <div className="markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: () => null,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Alert({ children }: { children: ReactNode }) {
  return (
    <div className="notice error" role="alert">
      {children}
    </div>
  );
}
function Empty({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">{icon}</div>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function App() {
  const [route, setRoute] = useState(currentRoute);
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("job-agent-theme") || "light",
  );
  async function refresh() {
    try {
      setData(await api<Bootstrap>("/bootstrap"));
      setError("");
    } catch (e) {
      setError(errorText(e));
    }
  }
  useEffect(() => {
    void refresh();
    const routeChange = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", routeChange);
    return () => window.removeEventListener("hashchange", routeChange);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("job-agent-theme", theme);
  }, [theme]);
  const nav = [
    ["/jobs", "My jobs", BriefcaseBusiness],
    ["/find", "Find jobs", Search],
    ["/profile", "My profile", UserRound],
  ] as const;
  return (
    <div className="shell">
      <header className="app-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => go("/")}
            aria-label="Job Agent home"
          >
            <span className="brand-mark">
              <BriefcaseBusiness size={20} />
            </span>
            <span>
              <span className="brand-name">Job Agent</span>
              <span className="brand-sub">Your next chapter</span>
            </span>
          </button>
          <nav aria-label="Main navigation">
            {nav.map(([path, label, Icon]) => (
              <button
                key={path}
                className={
                  route.startsWith(path) ? "nav-item active" : "nav-item"
                }
                onClick={() => go(path)}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="header-tools">
            <button
              className="icon-button"
              aria-label={
                theme === "light"
                  ? "Switch to dark theme"
                  : "Switch to light theme"
              }
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              className={
                "icon-button " + (route === "/settings" ? "active" : "")
              }
              aria-label="AI settings"
              onClick={() => go("/settings")}
            >
              <Settings2 size={19} />
            </button>
            <button className="btn primary" onClick={() => go("/new")}>
              <Plus size={16} />
              <span>New job</span>
            </button>
          </div>
        </div>
      </header>
      {error && (
        <div className="main">
          <Alert>
            {error}{" "}
            <button className="btn small" onClick={() => void refresh()}>
              Retry
            </button>
          </Alert>
        </div>
      )}
      {!data && !error ? (
        <div className="loading">
          <Spinner /> Opening your workspace…
        </div>
      ) : data ? (
        <main
          className={
            "main " + (route.startsWith("/job/") ? "conversation-main" : "")
          }
        >
          {route === "/" ? (
            <Home data={data} />
          ) : route === "/jobs" ? (
            <Jobs jobs={data.jobs} refresh={refresh} />
          ) : route === "/new" ? (
            <NewJob jobs={data.jobs} refresh={refresh} />
          ) : route === "/find" ? (
            <FindJobs
              profile={data.profile}
              jobs={data.jobs}
              refresh={refresh}
            />
          ) : route === "/profile" ? (
            <ProfilePage initial={data.profile} refresh={refresh} />
          ) : route === "/settings" ? (
            <SettingsPage initial={data.settings} refresh={refresh} />
          ) : route.startsWith("/job/") ? (
            <Chat
              key={route}
              id={route.slice(5)}
              refresh={refresh}
              profile={data.profile}
            />
          ) : (
            <Home data={data} />
          )}
        </main>
      ) : null}
      <footer className="app-footer">
        <span>Made for your next move.</span>
        <span>Saved on this device · v0.1</span>
      </footer>
    </div>
  );
}

function Home({ data }: { data: Bootstrap }) {
  const active = data.jobs.filter((j) => !j.archived);
  const submitted = active.filter((j) =>
    ["applied", "interview", "offer"].includes(j.status),
  );
  return (
    <>
      <section className="welcome">
        <div className="welcome-copy">
          <div className="eyebrow">
            <span className="tiny-dot" /> YOUR PERSONAL JOB WORKSPACE
          </div>
          <h1>
            Your next chapter
            <br />
            starts with a <em>conversation.</em>
          </h1>
          <p>
            Find the right opportunities. Tell your story well.
            <br />
            Keep every application moving, with a little help from AI.
          </p>
          <div className="welcome-actions">
            <button className="btn primary large" onClick={() => go("/new")}>
              <Plus size={18} /> Add a job
            </button>
            <button className="btn large" onClick={() => go("/job/general")}>
              <MessageCircle size={18} /> Let’s talk
            </button>
          </div>
          <div className="promise-row">
            <span>
              <Check size={14} /> Your choice of AI
            </span>
            <span>
              <Globe2 size={14} /> Any city. Any country.
            </span>
          </div>
        </div>
        <div className="journey-card">
          <div className="journey-top">
            <span className="soft-icon">
              <Sparkles size={22} />
            </span>
            <span>
              A little clarity.
              <br />
              <b>A confident next step.</b>
            </span>
          </div>
          {[
            ["01", "Discover", "Find opportunities that fit your life."],
            ["02", "Make it yours", "Shape a truthful, relevant application."],
            ["03", "Move forward", "Prepare, follow up, and keep track."],
          ].map(([n, t, d]) => (
            <div className="journey-step" key={n}>
              <span className="step-number">{n}</span>
              <div>
                <b>{t}</b>
                <p>{d}</p>
              </div>
            </div>
          ))}
          <div className="journey-foot">
            <span className="tiny-dot" /> One workspace, from first look to next
            offer.
          </div>
        </div>
      </section>
      <div className="stats-row">
        {[
          [active.length, "jobs in your workspace"],
          [submitted.length, "applications in progress"],
          [
            active.filter((j) => j.status === "interview").length,
            "interviews to prepare for",
          ],
        ].map(([n, t]) => (
          <div className="stat" key={t}>
            <strong>{n}</strong>
            <span>{t}</span>
          </div>
        ))}
      </div>
      {!data.profile.facts && (
        <button className="profile-nudge" onClick={() => go("/profile")}>
          <span className="soft-icon">
            <UserRound size={22} />
          </span>
          <span>
            <b>Start with your story</b>
            <span>
              Add your CV once. Your assistant can use the facts you confirm
              across all your applications.
            </span>
          </span>
          <ArrowRight size={20} />
        </button>
      )}
      <div className="section-title">
        <div>
          <p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
          <h2>Your recent jobs</h2>
        </div>
        <button className="text-button" onClick={() => go("/jobs")}>
          View all jobs <ArrowRight size={16} />
        </button>
      </div>
      {active.length ? (
        <div className="job-grid">
          {active.slice(0, 3).map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      ) : (
        <div className="start-options">
          <button className="start-option" onClick={() => go("/new")}>
            <span className="soft-icon">
              <Plus size={23} />
            </span>
            <div>
              <b>Already found something?</b>
              <p>Paste a posting and explore it together.</p>
            </div>
            <ChevronRight size={20} />
          </button>
          <button className="start-option" onClick={() => go("/find")}>
            <span className="soft-icon">
              <Search size={22} />
            </span>
            <div>
              <b>Open to what’s out there?</b>
              <p>Search by role, location and how you work.</p>
            </div>
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </>
  );
}
function JobCard({ job }: { job: Job }) {
  return (
    <button className="job-card" onClick={() => go("/job/" + job.id)}>
      <div className="job-card-top">
        <span className="company-avatar">
          {(job.company || job.title).slice(0, 1).toUpperCase()}
        </span>
        <Tag status={job.status} />
      </div>
      <h3>{job.title}</h3>
      <p>{job.company || "Company not added"}</p>
      <div className="job-card-bottom">
        <span>
          <Globe2 size={14} />
          {job.location || "Location not specified"}
        </span>
        <ArrowRight size={17} />
      </div>
      {job.deadline && (
        <div className="deadline">
          <Clock3 size={13} /> Deadline {shortDate(job.deadline)}
        </div>
      )}
    </button>
  );
}

function Jobs({
  jobs,
  refresh,
}: {
  jobs: Job[];
  refresh: () => Promise<void>;
}) {
  const [filter, setFilter] = useState("active"),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all");
  useEffect(() => {
    void refresh();
  }, []);
  const filtered = jobs.filter(
    (j) =>
      Boolean(j.archived) === (filter === "archived") &&
      (status === "all" || j.status === status) &&
      (j.title + " " + j.company + " " + j.location)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="YOUR APPLICATIONS"
        title="A place for every possibility."
        description="Your conversations, drafts and next steps, all together."
      />
      <div className="toolbar">
        <div className="segmented">
          <button
            className={filter === "active" ? "selected" : ""}
            onClick={() => setFilter("active")}
          >
            Active jobs
          </button>
          <button
            className={filter === "archived" ? "selected" : ""}
            onClick={() => setFilter("archived")}
          >
            Archived jobs
          </button>
        </div>
        <div className="toolbar-right">
          <input
            className="input"
            placeholder="Search your jobs…"
            aria-label="Search your jobs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="input"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            {Object.entries(statusLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      {filtered.length ? (
        <div className="job-grid">
          {filtered.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      ) : (
        <Empty
          icon={<BriefcaseBusiness />}
          title={
            filter === "archived"
              ? "No archived jobs here"
              : "Room for your next opportunity"
          }
        >
          {query || status !== "all"
            ? "Try another search or status."
            : "Save a job to keep its conversation and application in one place."}
        </Empty>
      )}
    </>
  );
}
function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

function NewJob({
  jobs,
  refresh,
}: {
  jobs: Job[];
  refresh: () => Promise<void>;
}) {
  const [form, setForm] = useState<JobForm>(emptyJob),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [verdict, setVerdict] = useState(""),
    [reapply, setReapply] = useState(false);
  const update = (k: keyof JobForm, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  async function fetchPosting() {
    setError("");
    setBusy("fetch");
    try {
      const r = await api<{
        title: string;
        description: string;
        url: string;
        verdict: string;
      }>("/import-url", "POST", { url: form.url });
      setForm((f) => ({
        ...f,
        title: f.title || r.title,
        description: r.description,
        url: r.url,
      }));
      setVerdict(r.verdict);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError("");
    try {
      const j = await api<Job>(
        "/jobs?allow_duplicate=" + reapply,
        "POST",
        form,
      );
      await refresh();
      go("/job/" + j.id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  const duplicate =
    form.url &&
    jobs.find(
      (j) =>
        j.url.replace(/\/$/, "") === form.url.replace(/\/$/, "") && !j.archived,
    );
  return (
    <>
      <PageTitle
        eyebrow="NEW OPPORTUNITY"
        title="Let’s take a closer look."
        description="Bring a link or a job description. We’ll take it from there."
      />
      <div className="two-column">
        <form className="surface form-panel" onSubmit={submit}>
          <Field
            label="Job link (optional)"
            hint="If the site blocks reading, paste the description below."
          >
            <div className="input-action">
              <input
                type="url"
                className="input"
                placeholder="https://company.com/careers/your-next-role"
                value={form.url}
                onChange={(e) => update("url", e.target.value)}
              />
              <button
                type="button"
                className="btn"
                disabled={!form.url || !!busy}
                onClick={() => void fetchPosting()}
              >
                {busy === "fetch" ? <Spinner /> : <Download size={16} />} Read
                link
              </button>
            </div>
          </Field>
          {verdict && (
            <div className="notice">
              {verdict.includes("⚠")
                ? "Some text in this posting looks unusual. Review the description before saving."
                : "Posting imported. Check the title, company and description before saving."}
            </div>
          )}
          {duplicate && (
            <div className="notice">
              You already have this posting.{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => go("/job/" + duplicate.id)}
              >
                Open existing job
              </button>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={reapply}
                  onChange={(e) => setReapply(e.target.checked)}
                />{" "}
                Create a separate application record
              </label>
            </div>
          )}
          <div className="field-grid">
            <Field label="Job title">
              <input
                required
                maxLength={200}
                className="input"
                placeholder="e.g. Product designer"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
              />
            </Field>
            <Field label="Company">
              <input
                maxLength={200}
                className="input"
                placeholder="Company name"
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
              />
            </Field>
            <Field label="Location">
              <input
                maxLength={300}
                className="input"
                placeholder="City, country or remote"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
              />
            </Field>
            <Field label="Deadline (optional)">
              <input
                type="date"
                className="input"
                value={form.deadline}
                onChange={(e) => update("deadline", e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Job description"
            hint="Include responsibilities, requirements and any location restrictions."
          >
            <textarea
              rows={12}
              maxLength={60000}
              className="textarea"
              placeholder="Paste the posting here…"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </Field>
          {error && <Alert>{error}</Alert>}
          <button
            className="btn primary large"
            disabled={!!busy || Boolean(duplicate && !reapply)}
          >
            {busy === "save" ? <Spinner /> : <MessageCircle size={18} />} Save
            job & start talking
          </button>
        </form>
        <aside className="side-note">
          <span className="soft-icon">
            <Sparkles size={24} />
          </span>
          <h2>
            One job.
            <br />
            Its own conversation.
          </h2>
          <p>
            Explore the fit, tailor your CV and prepare for an interview,
            without losing the thread.
          </p>
          <ul>
            <li>Your profile carries across jobs.</li>
            <li>Each application keeps its own documents.</li>
            <li>You decide when to apply.</li>
          </ul>
          <p className="muted small">
            No location limits. Add a posting from any country or language.
          </p>
        </aside>
      </div>
    </>
  );
}

function FindJobs({
  profile,
  jobs,
  refresh,
}: {
  profile: Profile;
  jobs: Job[];
  refresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState(""),
    [locations, setLocations] = useState(profile.locations),
    [mode, setMode] = useState(profile.work_mode),
    [matchMode, setMatchMode] = useState("title"),
    [sources, setSources] = useState("all"),
    [days, setDays] = useState(30);
  const [result, setResult] = useState<{
      jobs: (JobForm & {
        posted?: string;
        work_mode?: string;
        verification?: string;
      })[];
      errors: string[];
      coverage: string;
      filtered_out?: number;
      source_reports?: {
        name: string;
        status: string;
        matches: number;
        queries: string[];
      }[];
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(""),
    [expanded, setExpanded] = useState("");
  async function search(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await api("/search", "POST", {
          query,
          locations,
          work_mode: mode,
          match_mode: matchMode,
          sources,
          days,
        }),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(job: JobForm) {
    setSaving(job.url);
    setError("");
    try {
      const j = await api<Job>("/jobs", "POST", job);
      await refresh();
      go("/job/" + j.id);
    } catch (e) {
      if (
        e instanceof ApiError &&
        typeof e.detail === "object" &&
        e.detail &&
        "job_id" in e.detail
      ) {
        go("/job/" + e.detail.job_id);
      } else {
        setError(errorText(e));
      }
    } finally {
      setSaving("");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="EXPLORE WHAT’S NEXT"
        title="Good opportunities. Your terms."
        description="Search across locations, then choose the roles worth a conversation."
      />
      <form className="surface search-form" onSubmit={search}>
        <div className="search-primary">
          <Field label="Roles or skills">
            <input
              className="input"
              placeholder="e.g. Head of AI or Director of AI"
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <Field label="Cities or countries">
            <input
              className="input"
              placeholder="e.g. UK, UAE"
              value={locations}
              onChange={(e) => setLocations(e.target.value)}
            />
          </Field>
        </div>
        <div className="search-filters">
          <Field label="Match results">
            <select
              className="input"
              value={matchMode}
              onChange={(e) => setMatchMode(e.target.value)}
            >
              <option value="title">Job titles</option>
              <option value="broad">Broad keywords</option>
            </select>
          </Field>
          <Field label="How you work">
            <select
              className="input"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="any">Any arrangement</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </Field>
          <Field label="Search sources">
            <select
              className="input"
              value={sources}
              onChange={(e) => setSources(e.target.value)}
            >
              <option value="all">Freehire + web</option>
              <option value="web">Public web</option>
              <option value="freehire">Freehire</option>
            </select>
          </Field>
          <Field label="Posted within">
            <select
              className="input"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              disabled={sources === "web"}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </Field>
        </div>
        <div className="search-footer">
          <p>
            Separate roles with “or” and locations with commas. Leave locations
            blank for worldwide.
            <br />
            Date filtering applies to Freehire; check dates on web listings.
          </p>
          <button className="btn primary" disabled={busy}>
            {busy ? <Spinner /> : <Search size={17} />}
            {busy ? "Searching…" : "Find jobs"}
          </button>
        </div>
      </form>
      {error && <Alert>{error}</Alert>}
      {result ? (
        <>
          <div className="search-summary" role="status">
            <div>
              <b>{result.jobs.length} matching opportunities</b>
              <p>
                {result.filtered_out || 0} unrelated results filtered ·
                Duplicate links removed
              </p>
            </div>
            <span className="chip-label">
              {result.errors.length
                ? "Partial search · some sources unavailable"
                : "Search complete"}
            </span>
          </div>
          <details className="search-details surface">
            <summary>Search coverage & source details</summary>
            <p className="muted small">{result.coverage}</p>
            {result.errors.length > 0 && (
              <p className="notice">
                Some sources could not complete their search. Available results
                are shown below. You can retry or open the queries directly.
              </p>
            )}
            <div className="source-report-list">
              {result.source_reports?.map((source, i) => (
                <div className="source-report" key={i}>
                  <div>
                    <b>{source.name}</b>
                    <span className={"source-status " + source.status}>
                      {source.status === "no_results"
                        ? "No results returned"
                        : source.status === "unavailable"
                          ? "Unavailable"
                          : source.status === "partial"
                            ? "Partially searched"
                            : "Searched"}{" "}
                      · {source.matches} new matches
                    </span>
                  </div>
                  {source.queries.map((q) => (
                    <p key={q} className="source-query">
                      {q}
                      {source.name !== "Freehire" && (
                        <a
                          href={
                            "https://www.google.com/search?q=" +
                            encodeURIComponent(q)
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open search <ExternalLink size={12} />
                        </a>
                      )}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </details>
          <div className="section-title">
            <h2>{result.jobs.length} opportunities</h2>
            <span className="muted small">
              Review each original posting before applying
            </span>
          </div>
          {result.jobs.length ? (
            <div className="search-results">
              {result.jobs.map((j, i) => {
                const saved = jobs.find((x) => x.url === j.url && !x.archived);
                return (
                  <article className="surface search-result" key={j.url}>
                    <div className="result-heading">
                      <span className="company-avatar">
                        {(j.company || j.title).slice(0, 1)}
                      </span>
                      <div>
                        <h3>{j.title}</h3>
                        <p>
                          {j.company || "See original posting"} ·{" "}
                          {j.location || "Location not specified"}
                        </p>
                      </div>
                      <span className="result-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="result-meta">
                      <span className="chip-label">{j.source}</span>
                      {j.verification === "web_lead" && (
                        <span>Web lead · verify details on original</span>
                      )}
                      {j.work_mode && (
                        <span className="chip-label">{j.work_mode}</span>
                      )}
                      {j.posted && <span>Posted {shortDate(j.posted)}</span>}
                    </div>
                    <p
                      className={
                        "result-description " +
                        (expanded === j.url ? "expanded" : "")
                      }
                    >
                      {j.description ||
                        "Open the original posting for the full description."}
                    </p>
                    <div className="result-actions">
                      <button
                        className="text-button"
                        onClick={() =>
                          setExpanded(expanded === j.url ? "" : j.url)
                        }
                      >
                        {expanded === j.url ? "Show less" : "Read description"}
                      </button>
                      <a
                        className="text-button"
                        href={j.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Original <ExternalLink size={14} />
                      </a>
                      <button
                        className="btn primary"
                        disabled={saving === j.url}
                        onClick={() =>
                          saved ? go("/job/" + saved.id) : void save(j)
                        }
                      >
                        {saving === j.url ? (
                          <Spinner />
                        ) : saved ? (
                          <Check size={16} />
                        ) : (
                          <Plus size={16} />
                        )}{" "}
                        {saved ? "Open saved job" : "Save & discuss"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty icon={<Search />} title="No matching results returned">
              No matching titles in these sources’ limited sample does not mean
              no jobs exist. Try another location, a broader date range or the
              broad keyword option. You can always add a job from its link.
            </Empty>
          )}
        </>
      ) : (
        !busy && (
          <Empty icon={<Globe2 />} title="The search starts with you">
            Choose one place, several places, or the whole world. Your profile
            defaults are just a starting point.
          </Empty>
        )
      )}
      {busy && (
        <div className="loading">
          <Spinner /> Looking for opportunities…
        </div>
      )}
    </>
  );
}

const sourceKinds: Record<string, string> = {
  cv: "CV",
  academic_cv: "Academic CV",
  industry_cv: "Industry CV",
  publication: "Publication",
  book: "Book",
  certificate: "Certificate",
  portfolio: "Portfolio",
  other: "Other information",
  online: "Approved online finding",
};
type SavedCV = {
  kind?: string;
  approved?: boolean;
  source_url?: string;
  id: string;
  filename: string;
  title: string;
  created: string;
  text?: string;
};
function CVLibrary({
  activeId,
  revision,
  onChanged,
  onUse,
}: {
  activeId?: string;
  revision?: number;
  onChanged: () => void;
  onUse: (cv: SavedCV & { text: string }) => void;
}) {
  const [cvs, setCVs] = useState<SavedCV[]>([]),
    [busy, setBusy] = useState("");
  const [errors, setErrors] = useState<string[]>([]),
    [filter, setFilter] = useState("");
  const [review, setReview] = useState<(SavedCV & { text: string }) | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const refresh = async () => setCVs(await api<SavedCV[]>("/cvs"));
  useEffect(() => {
    void refresh().catch((e) => setErrors([errorText(e)]));
  }, [revision]);
  async function upload(files: File[]) {
    if (!files.length || busy) return;
    setErrors([]);
    setNotice("");
    const failures: string[] = [];
    let saved = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setBusy(`Uploading ${i + 1} of ${files.length}: ${f.name}`);
      try {
        if (f.size > 10 * 1024 * 1024)
          throw new Error("Use a file smaller than 10 MB.");
        const body = new FormData();
        body.append("file", f);
        await api("/cvs", "POST", body);
        saved++;
      } catch (e) {
        failures.push(`${f.name}: ${errorText(e)}`);
      }
    }
    try {
      await refresh();
    } catch (e) {
      failures.push(errorText(e));
    }
    onChanged();
    setErrors(failures);
    setBusy("");
    setNotice(
      `${saved} of ${files.length} files processed. Identical files are kept once. Review and approve documents before the assistant uses them.`,
    );
    if (file.current) file.current.value = "";
  }
  async function open(cv: SavedCV) {
    setErrors([]);
    try {
      setReview(await api("/cvs/" + cv.id));
    } catch (e) {
      setErrors([errorText(e)]);
    }
  }
  async function saveReview(use: boolean) {
    if (!review) return;
    setBusy("Saving CV");
    setErrors([]);
    try {
      const cv = await api<SavedCV & { text: string }>(
        "/cvs/" + review.id,
        "PUT",
        {
          title: review.title,
          text: review.text,
          kind: review.kind || "cv",
          approved: Boolean(review.approved),
        },
      );
      await refresh();
      onChanged();
      if (use) onUse(cv);
      setReview(null);
      setNotice(
        use
          ? "CV added to your profile draft. Review your career facts and save the profile."
          : "Document saved. Only approved documents are used by your assistant.",
      );
    } catch (e) {
      setErrors([errorText(e)]);
    } finally {
      setBusy("");
    }
  }
  return (
    <section
      id="career-library"
      className="surface cv-library"
      aria-label="CV library"
    >
      <div className="panel-heading">
        <h2>
          Your career library <span className="muted">({cvs.length})</span>
        </h2>
        <span className="chip-label">
          {cvs.filter((cv) => cv.approved).length} of {cvs.length} approved for
          AI
        </span>
      </div>
      <p className="muted small">
        Add academic and industry CVs, publications, books, certificates and
        other evidence. Review each document and approve it for your assistant.
        Originals remain available to download.
      </p>
      <div
        className="cv-upload-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(Array.from(e.dataTransfer.files));
        }}
      >
        <button
          type="button"
          className="btn"
          disabled={!!busy}
          onClick={() => file.current?.click()}
        >
          {busy ? <Spinner /> : <Paperclip size={16} />} Upload documents
        </button>
        <p>
          Choose multiple files or drop them here · PDF, DOCX, TXT, MD · 10 MB
          each
        </p>
        <input
          type="file"
          aria-label="Upload CV files"
          hidden
          multiple
          ref={file}
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => void upload(Array.from(e.target.files || []))}
        />
      </div>
      {busy && (
        <p role="status" className="muted small">
          {busy}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {!review && errors.map((e) => <Alert key={e}>{e}</Alert>)}
      {cvs.length > 0 && (
        <>
          <input
            className="input"
            aria-label="Search CV library"
            placeholder="Find a document by name…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="cv-list">
            {cvs
              .filter((c) =>
                (c.title + c.filename)
                  .toLowerCase()
                  .includes(filter.toLowerCase()),
              )
              .map((cv) => (
                <div className="cv-row" key={cv.id}>
                  <FileText size={20} />
                  <div>
                    <b>{cv.title}</b>
                    <p>
                      {cv.filename} · {shortDate(cv.created)} ·{" "}
                      {sourceKinds[cv.kind || "cv"]} ·{" "}
                      {cv.approved ? "Approved for AI" : "Needs review"}
                      {activeId === cv.id ? " · Selected for profile" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    disabled={!!busy}
                    onClick={() => void open(cv)}
                  >
                    Review document
                  </button>
                </div>
              ))}
          </div>
        </>
      )}
      {review && (
        <Modal
          title="Review career document"
          onClose={() => !busy && setReview(null)}
        >
          <Field label="Document name">
            <input
              className="input"
              value={review.title}
              maxLength={200}
              onChange={(e) => setReview({ ...review, title: e.target.value })}
            />
          </Field>
          <Field
            label="Document text"
            hint="Check extracted text before using it. Edits change this library copy; the original file is preserved."
          >
            <textarea
              className="textarea import-review"
              maxLength={300000}
              value={review.text}
              onChange={(e) => setReview({ ...review, text: e.target.value })}
            />
          </Field>
          <Field label="Document type">
            <select
              className="input"
              value={review.kind || "cv"}
              onChange={(e) => setReview({ ...review, kind: e.target.value })}
            >
              {Object.entries(sourceKinds).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <label className="check-label">
            <input
              type="checkbox"
              checked={Boolean(review.approved)}
              onChange={(e) =>
                setReview({ ...review, approved: e.target.checked })
              }
            />{" "}
            I have reviewed this text. Allow my assistant to use it across job
            conversations.
          </label>
          {review.source_url && (
            <p className="muted small">
              Source:{" "}
              <a
                href={review.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View original
              </a>
            </p>
          )}
          {errors.map((e) => (
            <Alert key={e}>{e}</Alert>
          ))}
          {activeId !== review.id && (
            <p className="muted small">
              Using this CV replaces the career facts in your unsaved profile
              form. Save your profile to apply the change.
            </p>
          )}
          <div className="modal-actions">
            <button
              className="btn"
              disabled={!!busy}
              onClick={() =>
                void download(
                  `/cvs/${review.id}/original`,
                  review.filename,
                ).catch((e) => setErrors([errorText(e)]))
              }
            >
              Download original
            </button>
            <button
              className="btn"
              disabled={!!busy || !review.text.trim() || !review.title.trim()}
              onClick={() => void saveReview(false)}
            >
              {review.approved
                ? "Save and approve document"
                : "Save without approval"}
            </button>
            <button
              className="btn primary"
              disabled={!!busy || !review.text.trim() || !review.title.trim()}
              onClick={() => void saveReview(true)}
              style={
                !["cv", "academic_cv", "industry_cv"].includes(
                  review.kind || "cv",
                ) || review.text.length > 50000
                  ? { display: "none" }
                  : undefined
              }
            >
              Use as profile
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function CareerResearch({
  onAdded,
  revision,
}: {
  onAdded: () => void;
  revision: number;
}) {
  const [readiness, setReadiness] = useState<{
    total: number;
    approved: number;
    ready: boolean;
  } | null>(null);
  useEffect(() => {
    void api<{ total: number; approved: number; ready: boolean }>(
      "/profile/readiness",
    )
      .then(setReadiness)
      .catch(() => setReadiness(null));
  }, [revision]);
  const [query, setQuery] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState("");
  const [error, setError] = useState(""),
    [analysis, setAnalysis] = useState("");
  const [candidates, setCandidates] = useState<
    { id: string; title: string; text: string; url: string }[] | null
  >(null);
  const [review, setReview] = useState<{
    id: string;
    title: string;
    text: string;
    url: string;
  } | null>(null);
  async function analyse() {
    setBusy("analysis");
    setError("");
    try {
      const r = await api<{ analysis: string; truncated: boolean }>(
        "/profile/analyse",
        "POST",
        {},
      );
      setAnalysis(
        r.analysis +
          (r.truncated
            ? "\n\nSome documents were represented by excerpts because of the context limit."
            : ""),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  async function search() {
    setBusy("research");
    setError("");
    setCandidates(null);
    try {
      const r = await api<{ candidates: NonNullable<typeof candidates> }>(
        "/profile/research",
        "POST",
        { query, consent },
      );
      setCandidates(r.candidates);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  async function approve() {
    if (!review) return;
    setBusy("approve");
    setError("");
    try {
      await api(`/profile/research/${review.id}/approve`, "POST", {
        title: review.title,
        text: review.text,
        approved: true,
        kind: "online",
      });
      setCandidates((list) => list?.filter((c) => c.id !== review.id) || []);
      setReview(null);
      onAdded();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="surface cv-library">
      <div className="panel-heading">
        <h2>Understand and enrich your profile</h2>
        <button
          className="btn"
          disabled={!!busy || !readiness?.ready}
          onClick={() => void analyse()}
        >
          {busy === "analysis" ? <Spinner /> : <Sparkles size={16} />} Analyse
          approved information
        </button>
      </div>
      <p className="muted small">
        Your assistant uses approved library evidence for each job. Analyse it
        here to review academic and industry strengths, gaps and conflicting
        facts. Analysis sends approved source excerpts and your saved profile to
        your selected AI provider.
      </p>
      {readiness && !readiness.ready && (
        <div className="notice" role="status">
          <b>
            {readiness.total
              ? `${readiness.total} uploaded documents are waiting for your review.`
              : "Add career information to get started."}
          </b>
          <p>
            Open a document, check the text and document type, tick “I have
            reviewed this text”, then choose “Save and approve document”.
            Approve each source you want included. You can also enter career
            facts below and save your profile.
          </p>
          <a
            className="btn"
            href="#career-library"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("career-library")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Go to career library
          </a>
        </div>
      )}
      {readiness?.ready && (
        <p className="muted small" role="status">
          Ready to analyse · {readiness.approved} approved documents
          {readiness.approved === 0 ? " · saved profile text available" : ""}
        </p>
      )}
      {analysis && (
        <div className="notice">
          <Markdown>{analysis}</Markdown>
        </div>
      )}
      <details className="search-details">
        <summary>
          Would you like to check your public online information?
        </summary>
        <p className="muted small">
          Enter your name plus an employer, institution or public profile
          identifier to avoid namesakes. Only the query below is sent to public
          search services. Your CVs are not uploaded. Results remain unverified
          until you review them.
        </p>
        <Field label="Public profile search">
          <input
            className="input"
            maxLength={250}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setConsent(false);
            }}
            placeholder="Your name, university or employer"
          />
        </Field>
        <label className="check-label">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />{" "}
          I approve searching online using this exact query.
        </label>
        <button
          className="btn"
          disabled={!!busy || !consent || query.trim().length < 3}
          onClick={() => void search()}
        >
          {busy === "research" ? <Spinner /> : <Globe2 size={16} />} Search
          public information
        </button>
        {candidates && (
          <p className="muted small">
            {candidates.length} findings awaiting review. Confirm identity,
            accuracy and authorship before adding any text.
          </p>
        )}
        {candidates?.map((c) => (
          <div className="cv-row" key={c.id}>
            <div>
              <b>{c.title}</b>
              <p>{c.text}</p>
              <a href={c.url} target="_blank" rel="noopener noreferrer">
                View source
              </a>
            </div>
            <button
              className="btn"
              disabled={!!busy}
              onClick={() => setReview(c)}
            >
              Review finding
            </button>
          </div>
        ))}
      </details>
      {!review && error && <Alert>{error}</Alert>}
      {review && (
        <Modal
          title="Approve online information"
          onClose={() => !busy && setReview(null)}
        >
          <p>
            Check that this source describes you. Edit the text to include only
            facts you confirm. Search excerpts may be incomplete or refer to
            another person.
          </p>
          <a href={review.url} target="_blank" rel="noopener noreferrer">
            Open source
          </a>
          <Field label="Finding title">
            <input
              className="input"
              maxLength={200}
              value={review.title}
              onChange={(e) => setReview({ ...review, title: e.target.value })}
            />
          </Field>
          <Field label="Facts I approve">
            <textarea
              className="textarea"
              rows={8}
              maxLength={50000}
              value={review.text}
              onChange={(e) => setReview({ ...review, text: e.target.value })}
            />
          </Field>
          {error && <Alert>{error}</Alert>}
          <div className="modal-actions">
            <button
              className="btn"
              disabled={!!busy}
              onClick={() => setReview(null)}
            >
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={!!busy || !review.text.trim() || !review.title.trim()}
              onClick={() => void approve()}
            >
              Approve and add to library
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function ProfilePage({
  initial,
  refresh,
}: {
  initial: Profile;
  refresh: () => Promise<void>;
}) {
  const [savedForm, setSavedForm] = useState(initial);
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState(initial),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const update = (key: keyof Profile, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setNote("");
  };
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError("");
    try {
      const saved = await api<Profile>("/profile", "PUT", form);
      setForm(saved);
      setSavedForm(saved);
      setRevision((v) => v + 1);
      await refresh();
      setNote("Your profile is saved. New replies will use these facts.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR STORY, IN YOUR WORDS"
        title="A strong starting point."
        description="Keep the facts accurate. Your assistant will help with how you tell them."
      />
      <CVLibrary
        revision={revision}
        onChanged={() => setRevision((v) => v + 1)}
        activeId={form.source_cv_id}
        onUse={(cv) => {
          setForm((f) => ({ ...f, facts: cv.text, source_cv_id: cv.id }));
          setNote(
            "Selected CV added to your draft. Save profile to use it in new conversations.",
          );
        }}
      />
      <CareerResearch
        revision={revision}
        onAdded={() => setRevision((v) => v + 1)}
      />
      <div className="two-column">
        <form className="surface form-panel" onSubmit={save}>
          <div className="panel-heading">
            <h2>Career profile</h2>
            <span className="chip-label" role="status">
              {dirty ? "Unsaved changes" : "Saved profile"}
            </span>
          </div>
          <Field label="Your name">
            <input
              className="input"
              maxLength={200}
              value={form.name}
              placeholder="How should we address you?"
              onChange={(e) => update("name", e.target.value)}
            />
          </Field>
          <Field
            label="Verified career facts"
            hint="Experience, dates, education, skills, achievements and contact details you want included. Importing a file lets you review the text before saving."
          >
            <textarea
              className="textarea"
              rows={10}
              maxLength={50000}
              placeholder="Paste your CV, or describe your experience…"
              value={form.facts}
              onChange={(e) => update("facts", e.target.value)}
            />
          </Field>
          <Field
            label="LinkedIn profile link"
            hint="Add your profile URL. The app does not sign in to LinkedIn or read the link automatically."
          >
            <input
              type="url"
              className="input"
              maxLength={1000}
              value={form.linkedin_url || ""}
              placeholder="https://www.linkedin.com/in/your-name"
              onChange={(e) => update("linkedin_url", e.target.value)}
            />
          </Field>
          <Field
            label="LinkedIn profile text"
            hint="Paste your About and Experience sections, or upload a LinkedIn PDF to your CV library. Only supplied text is used by the assistant."
          >
            <textarea
              className="textarea"
              rows={5}
              maxLength={20000}
              value={form.linkedin_text || ""}
              onChange={(e) => update("linkedin_text", e.target.value)}
              placeholder="Paste the profile details you want your assistant to use…"
            />
          </Field>
          <Field
            label="What you’re looking for"
            hint="Roles, salary expectations, languages, relocation preferences and work-permission constraints. Only share what you want the AI to use."
          >
            <textarea
              className="textarea"
              rows={4}
              maxLength={10000}
              value={form.preferences}
              onChange={(e) => update("preferences", e.target.value)}
              placeholder="What matters in your next role?"
            />
          </Field>
          <div className="field-grid">
            <Field label="Preferred cities or countries">
              <input
                className="input"
                value={form.locations}
                maxLength={1000}
                onChange={(e) => update("locations", e.target.value)}
                placeholder="London, Germany, Canada"
              />
            </Field>
            <Field label="Work arrangement">
              <select
                className="input"
                value={form.work_mode}
                onChange={(e) => update("work_mode", e.target.value)}
              >
                <option value="any">Any arrangement</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </Field>
          </div>
          <Field label="Your writing style">
            <textarea
              className="textarea"
              rows={3}
              maxLength={4000}
              value={form.writing_style}
              onChange={(e) => update("writing_style", e.target.value)}
              placeholder="e.g. Warm and direct. British English. Avoid buzzwords."
            />
          </Field>
          {error && <Alert>{error}</Alert>}
          {note && (
            <div className="notice success">
              <CheckCircle2 size={17} />
              {note}
            </div>
          )}
          <button className="btn primary large" disabled={!!busy}>
            {busy === "save" ? <Spinner /> : <Check size={18} />} Save profile
          </button>
        </form>
        <aside className="side-note">
          <span className="soft-icon">
            <UserRound size={24} />
          </span>
          <h2>
            You supply the facts.
            <br />
            AI helps tell the story.
          </h2>
          <p>
            This profile is shared across your job conversations. You can update
            it whenever your experience or goals change.
          </p>
          <p>
            Your records stay on this device. Relevant profile and job details
            are sent to the AI connection you select when you ask for help.
          </p>
          <button
            className="btn"
            onClick={() =>
              void download("/export", "job-agent-backup.zip").catch((e) =>
                setError(errorText(e)),
              )
            }
          >
            <Download size={16} /> Export my records
          </button>
        </aside>
      </div>
    </>
  );
}

function SettingsPage({
  initial,
  refresh,
}: {
  initial: Settings;
  refresh: () => Promise<void>;
}) {
  const [form, setForm] = useState(initial),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState("");
  async function load() {
    setBusy("catalog");
    try {
      setCatalog(await api("/catalog"));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function action(test: boolean) {
    setBusy(test ? "test" : "save");
    setError("");
    setNote("");
    try {
      await api(
        test ? "/settings/test" : "/settings",
        test ? "POST" : "PUT",
        form,
      );
      if (!test) await refresh();
      setNote(
        test
          ? "Connection ready. This model answered successfully."
          : "AI settings saved for Job Agent.",
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  const models =
    catalog?.providers.find((p) => p.id === (form.provider || catalog.provider))
      ?.models || [];
  return (
    <>
      <PageTitle
        eyebrow="FAMILIAR CONNECTIONS"
        title="Your assistant. Your choice of AI."
        description="Use your existing connection, with settings kept separate from Appling."
      />
      <div className="settings-layout">
        <div className="surface form-panel">
          <h2>Choose a connection</h2>
          <div className="connection-cards">
            {[
              [
                "hermes",
                "Appling connections",
                "Use the providers and models already linked in Appling.",
              ],
              [
                "claude",
                "Claude Code",
                "Use the Claude Code sign-in on this computer.",
              ],
            ].map(([id, title, desc]) => (
              <button
                key={id}
                className={
                  "connection-card " + (form.engine === id ? "chosen" : "")
                }
                onClick={() => {
                  setForm({
                    engine: id as Settings["engine"],
                    provider: "",
                    model: "",
                  });
                  setNote("");
                }}
              >
                <div>
                  <b>{title}</b>
                  {form.engine === id && <CheckCircle2 size={18} />}
                </div>
                <p>{desc}</p>
              </button>
            ))}
          </div>
          {form.engine === "hermes" ? (
            <>
              <div className="panel-heading">
                <h3>Linked models</h3>
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={() => void load()}
                >
                  <RefreshCw size={15} /> Refresh
                </button>
              </div>
              {busy === "catalog" && (
                <div className="muted">
                  <Spinner /> Reading available connections…
                </div>
              )}
              {catalog && !catalog.hermes_available && (
                <div className="notice">
                  Appling’s runtime was not found. See the setup guide for
                  connecting an existing installation, or use Claude Code.
                </div>
              )}
              {catalog?.error && <Alert>{catalog.error}</Alert>}
              <Field label="Provider">
                <select
                  className="input"
                  value={form.provider}
                  onChange={(e) => {
                    setForm({ ...form, provider: e.target.value, model: "" });
                    setNote("");
                  }}
                >
                  <option value="">Follow Appling’s current provider</option>
                  {catalog?.providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Model">
                <input
                  className="input"
                  list="model-options"
                  placeholder={catalog?.model || "Follow the current model"}
                  value={form.model}
                  onChange={(e) => {
                    setForm({ ...form, model: e.target.value });
                    setNote("");
                  }}
                />
                <datalist id="model-options">
                  {models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>
              <p className="muted small">
                Choose a model when switching provider. Leaving both fields
                empty follows Appling’s current choice without changing it.
              </p>
            </>
          ) : (
            <>
              <Field label="Claude model (optional)">
                <input
                  className="input"
                  value={form.model}
                  placeholder="Use your Claude Code default"
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </Field>
              <p className="muted small">
                Uses your existing Claude Code subscription sign-in. API keys
                are not substituted.{" "}
                {catalog && !catalog.claude_available
                  ? "Claude Code was not found on this computer."
                  : ""}
              </p>
            </>
          )}
          {error && <Alert>{error}</Alert>}
          {note && (
            <div className="notice success">
              <CheckCircle2 size={17} />
              {note}
            </div>
          )}
          <div className="button-row">
            <button
              className="btn primary"
              disabled={
                !!busy ||
                Boolean(
                  form.engine === "hermes" && form.provider && !form.model,
                )
              }
              onClick={() => void action(false)}
            >
              {busy === "save" ? <Spinner /> : <Check size={17} />} Save
              settings
            </button>
            <button
              className="btn"
              disabled={
                !!busy ||
                Boolean(
                  form.engine === "hermes" && form.provider && !form.model,
                )
              }
              onClick={() => void action(true)}
            >
              {busy === "test" ? <Spinner /> : <Sparkles size={17} />} Test
              connection
            </button>
          </div>
          <p className="muted tiny">
            Testing sends a short request and may use your provider’s quota.
          </p>
        </div>
        <aside className="side-note">
          <span className="soft-icon">
            <Settings2 size={24} />
          </span>
          <h2>
            Connected, without
            <br />
            starting over.
          </h2>
          <p>
            Job Agent uses your existing sign-in. It does not copy API keys into
            this app or change Appling’s preferences.
          </p>
          <p>
            Cloud AI receives the context needed for your request. Provider
            limits and charges still apply. Drafting documents includes a second
            review pass.
          </p>
          <div className="notice">
            Search and saved records work independently of your AI connection.
          </div>
        </aside>
      </div>
    </>
  );
}

function Chat({
  id,
  refresh,
  profile,
}: {
  id: string;
  refresh: () => Promise<void>;
  profile: Profile;
}) {
  const [data, setData] = useState<Conversation | null>(null),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [sending, setSending] = useState(false),
    [tab, setTab] = useState("details");
  const [document, setDocument] = useState<Artifact | null>(null),
    [editingDoc, setEditingDoc] = useState(false),
    [draft, setDraft] = useState(""),
    [savingDoc, setSavingDoc] = useState(false);
  const [status, setStatus] = useState<string | null>(null),
    [eventDate, setEventDate] = useState(() => {
      const d = new Date();
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
    }),
    [statusBusy, setStatusBusy] = useState(false);
  const [editJob, setEditJob] = useState<JobForm | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const active = data?.run?.status === "running";
  async function load() {
    const next = await api<Conversation>("/jobs/" + id);
    setData(next);
  }
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const next = await api<Conversation>("/jobs/" + id);
        if (alive) setData(next);
      } catch (e) {
        if (alive) setError(errorText(e));
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [data?.messages.length, sending]);
  async function send(value = text) {
    if (!value.trim() || active || sending) return;
    setSending(true);
    setError("");
    try {
      await api("/jobs/" + id + "/messages", "POST", { text: value });
      setText("");
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSending(false);
    }
  }
  async function setJobStatus() {
    if (!status) return;
    setStatusBusy(true);
    setError("");
    try {
      await api("/jobs/" + id + "/status", "POST", { status, date: eventDate });
      setStatus(null);
      await load();
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setStatusBusy(false);
    }
  }
  async function archive() {
    try {
      await api(
        "/jobs/" + id + "/archive?archived=" + !data?.job?.archived,
        "POST",
      );
      await load();
      await refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function saveDoc() {
    if (!document) return;
    setSavingDoc(true);
    setError("");
    try {
      const saved = await api<Artifact>("/jobs/" + id + "/documents", "POST", {
        kind: document.kind,
        title: document.title,
        content: draft,
      });
      setDocument(saved);
      setEditingDoc(false);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSavingDoc(false);
    }
  }
  if (!data)
    return (
      <>
        {error ? (
          <Alert>{error}</Alert>
        ) : (
          <div className="loading">
            <Spinner /> Opening conversation…
          </div>
        )}
      </>
    );
  const job = data.job;
  const suggestions = job
    ? [
        "Is this a good fit for me?",
        "Draft my CV and cover letter",
        "Help me prepare for an interview",
      ]
    : [
        "Help me clarify what I want next",
        "How should I approach my job search?",
        "Help me improve my career profile",
      ];
  const latest: Artifact[] = [],
    kinds = new Set<string>();
  data.documents.forEach((d) => {
    if (!kinds.has(d.kind)) {
      latest.push(d);
      kinds.add(d.kind);
    }
  });
  return (
    <>
      <div className="conversation-heading">
        <button
          className="icon-button"
          aria-label="Back to jobs"
          onClick={() => go("/jobs")}
        >
          <ArrowLeft size={19} />
        </button>
        <div>
          <p>{job?.company || "YOUR JOB-SEARCH ASSISTANT"}</p>
          <h1>{job?.title || "Let’s figure out your next move."}</h1>
        </div>
        {job && <Tag status={job.status} />}
      </div>
      <div className={"workspace " + (!job ? "general-workspace" : "")}>
        <section className="chat-panel">
          <div className="chat-scroll" aria-live="polite">
            {!data.messages.length && (
              <div className="chat-welcome">
                <span className="soft-icon">
                  <Sparkles size={26} />
                </span>
                <h2>
                  {job
                    ? "A fresh perspective on this role."
                    : `Hello${profile.name ? ", " + profile.name.split(" ")[0] : ""}. Where shall we start?`}
                </h2>
                <p>
                  {job
                    ? "Ask about the fit, work on your application, or talk through your next step."
                    : "Tell me what you’re looking for, what’s on your mind, or where you feel stuck."}
                </p>
                {job && !profile.facts && (
                  <button
                    className="profile-inline"
                    onClick={() => go("/profile")}
                  >
                    <UserRound size={17} /> Add your CV in My profile for
                    personalised help <ArrowRight size={16} />
                  </button>
                )}
                <div className="suggestions">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      disabled={sending}
                      onClick={() => void send(s)}
                    >
                      {s}
                      <ArrowUp size={15} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {data.messages.map((m) => (
              <article key={m.id} className={"message " + m.role}>
                <div className="message-label">
                  {m.role === "user" ? (
                    "You"
                  ) : (
                    <>
                      <Sparkles size={13} /> Job Agent
                    </>
                  )}
                  <time>
                    {new Date(m.created).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <Text>{m.content}</Text>
                {m.metadata.document_ids?.map((docId) => {
                  const d = data.documents.find((x) => x.id === docId);
                  return d ? (
                    <button
                      key={d.id}
                      className="document-link"
                      onClick={() => {
                        setDocument(d);
                        setEditingDoc(false);
                      }}
                    >
                      <FileText size={18} />
                      <span>
                        <b>{d.title}</b>
                        <small>Open draft · PDF / Word</small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  ) : null;
                })}
                {job && m.metadata.suggested_status && (
                  <button
                    className="btn small"
                    onClick={() => setStatus(m.metadata.suggested_status!)}
                  >
                    Review status: {statusLabels[m.metadata.suggested_status]}
                  </button>
                )}
              </article>
            ))}
            {active && (
              <div className="working">
                <Spinner />
                <span>{data.run?.stage}…</span>
              </div>
            )}
            {data.run?.status === "failed" ||
            data.run?.status === "interrupted" ? (
              <Alert>
                {data.run.error}
                <button
                  className="btn small"
                  onClick={() => {
                    const last = [...data.messages]
                      .reverse()
                      .find((m) => m.role === "user");
                    if (last) void send(last.content);
                  }}
                >
                  Retry last request
                </button>
              </Alert>
            ) : null}
            {data.run?.status === "cancelled" && (
              <p className="muted small">
                Response stopped. Your conversation is saved.
              </p>
            )}
            <div ref={bottom} />
          </div>
          {error && <Alert>{error}</Alert>}
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              aria-label="Message"
              placeholder={
                job ? "Talk about this opportunity…" : "What’s on your mind?"
              }
              rows={2}
              value={text}
              maxLength={16000}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="composer-bottom">
              <span>Enter to send · Shift + Enter for a new line</span>
              {active ? (
                <button
                  type="button"
                  className="send-button stop"
                  aria-label="Stop response"
                  onClick={() =>
                    void api("/runs/" + data.run!.id + "/cancel", "POST")
                      .then(load)
                      .catch((e) => setError(errorText(e)))
                  }
                >
                  <Square size={16} />
                </button>
              ) : (
                <button
                  className="send-button"
                  aria-label="Send message"
                  disabled={sending || !text.trim()}
                >
                  {sending ? <Spinner /> : <ArrowUp size={19} />}
                </button>
              )}
            </div>
          </form>
          <div className="chat-footnote">
            AI can make mistakes. Review facts and documents before using them.
            Recent chat context is sent to your selected provider.
          </div>
        </section>
        {job && (
          <aside className="job-sidebar">
            <div className="sidebar-tabs">
              {["details", "documents", "history"].map((t) => (
                <button
                  key={t}
                  className={tab === t ? "selected" : ""}
                  onClick={() => setTab(t)}
                >
                  {t === "documents"
                    ? `Documents${latest.length ? " · " + latest.length : ""}`
                    : t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div className="sidebar-content">
              {tab === "details" ? (
                <>
                  <div className="company-detail">
                    <span className="company-avatar">
                      {(job.company || job.title).slice(0, 1)}
                    </span>
                    <div>
                      <b>{job.company || "Company not added"}</b>
                      <span>{job.location || "Location not specified"}</span>
                    </div>
                  </div>
                  <div className="detail-pair">
                    <span>Status</span>
                    <button
                      className="text-button"
                      onClick={() => setStatus(job.status)}
                    >
                      {statusLabels[job.status]} <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="detail-pair">
                    <span>Deadline</span>
                    <b>
                      {job.deadline ? shortDate(job.deadline) : "Not specified"}
                    </b>
                  </div>
                  {job.url && (
                    <a
                      className="btn original-link"
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Original posting <ExternalLink size={15} />
                    </a>
                  )}
                  <h3 className="sidebar-label">ABOUT THIS ROLE</h3>
                  <div className="posting-text">
                    {job.description ||
                      "No description yet. Add one to get more useful advice."}
                  </div>
                  <button
                    className="text-button"
                    onClick={() =>
                      setEditJob({
                        title: job.title,
                        company: job.company,
                        location: job.location,
                        url: job.url,
                        description: job.description,
                        deadline: job.deadline,
                        source: job.source,
                      })
                    }
                  >
                    Edit job details
                  </button>
                  <div className="sidebar-bottom">
                    <button className="btn" onClick={() => void archive()}>
                      <Archive size={15} />
                      {job.archived ? "Restore to active jobs" : "Archive job"}
                    </button>
                  </div>
                </>
              ) : tab === "documents" ? (
                <>
                  <p className="muted small">
                    Every revision is saved. Submitted versions remain preserved
                    in History.
                  </p>
                  {latest.map((d) => (
                    <button
                      className="sidebar-document"
                      key={d.id}
                      onClick={() => {
                        setDocument(d);
                        setEditingDoc(false);
                      }}
                    >
                      <FileText size={20} />
                      <span>
                        <b>{kindLabels[d.kind]}</b>
                        <small>{shortDate(d.created)}</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                  {!latest.length && (
                    <Empty
                      icon={<FileText />}
                      title="Your drafts will live here"
                    >
                      Ask your assistant to prepare a CV, cover letter or
                      interview pack.
                    </Empty>
                  )}
                  {data.documents.length > latest.length && (
                    <details className="version-list">
                      <summary>
                        Previous versions (
                        {data.documents.length - latest.length})
                      </summary>
                      {data.documents
                        .filter((d) => !latest.includes(d))
                        .map((d) => (
                          <button
                            key={d.id}
                            onClick={() => {
                              setDocument(d);
                              setEditingDoc(false);
                            }}
                          >
                            {kindLabels[d.kind]} · {shortDate(d.created)}
                          </button>
                        ))}
                    </details>
                  )}
                </>
              ) : (
                <>
                  <button
                    className="btn primary"
                    onClick={() => setStatus(job.status)}
                  >
                    Record an update
                  </button>
                  <div className="timeline">
                    {data.events.map((e) => (
                      <div className="timeline-item" key={e.id}>
                        <span className="timeline-dot" />
                        <b>{statusLabels[e.label]}</b>
                        <small>{shortDate(e.data.date)}</small>
                        {e.data.document_ids?.map((docId) => {
                          const d = data.documents.find((x) => x.id === docId);
                          return d ? (
                            <button
                              key={docId}
                              className="text-button"
                              onClick={() => {
                                setDocument(d);
                                setEditingDoc(false);
                              }}
                            >
                              Submitted {kindLabels[d.kind]?.toLowerCase()}
                            </button>
                          ) : null;
                        })}
                      </div>
                    ))}
                    <div className="timeline-item">
                      <span className="timeline-dot" />
                      <b>Job saved</b>
                      <small>{shortDate(job.created)}</small>
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>
      {document && (
        <Modal title={document.title} onClose={() => setDocument(null)}>
          <div className="document-toolbar">
            <span className="muted small">
              Draft · {shortDate(document.created)}
            </span>
            <div className="button-row">
              {["pdf", "docx", "md"].map((format) => (
                <button
                  className="btn small"
                  key={format}
                  onClick={() =>
                    void download(
                      "/documents/" + document.id + "/" + format,
                      document.kind + "." + format,
                    ).catch((e) => setError(errorText(e)))
                  }
                >
                  <Download size={14} />
                  {format === "docx" ? "Word" : format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {error && <Alert>{error}</Alert>}
          {editingDoc ? (
            <textarea
              className="textarea document-editor"
              aria-label="Edit document"
              value={draft}
              maxLength={40000}
              onChange={(e) => setDraft(e.target.value)}
            />
          ) : (
            <div className="document-preview">
              <Text>{document.content}</Text>
            </div>
          )}
          <div className="modal-actions">
            <span className="muted tiny">
              Review all claims before submitting.
            </span>
            {editingDoc ? (
              <button
                className="btn primary"
                disabled={savingDoc || !draft.trim()}
                onClick={() => void saveDoc()}
              >
                {savingDoc ? <Spinner /> : <Check size={16} />} Save new version
              </button>
            ) : (
              <button
                className="btn"
                onClick={() => {
                  setDraft(document.content);
                  setEditingDoc(true);
                }}
              >
                Edit this draft
              </button>
            )}
          </div>
        </Modal>
      )}
      {status && (
        <Modal
          title="Record an application update"
          onClose={() => setStatus(null)}
        >
          <p className="muted">
            This updates your record. It does not submit or send anything.
          </p>
          <Field label="Status">
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {Object.entries(statusLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="When did this happen?">
            <input
              type="date"
              className="input"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </Field>
          {status === "applied" && (
            <div className="notice">
              The latest CV and cover letter and this posting will be preserved
              as your submitted record. Make sure these are the versions you
              actually sent.
            </div>
          )}
          {error && <Alert>{error}</Alert>}
          <div className="modal-actions">
            <button className="btn" onClick={() => setStatus(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={statusBusy || !eventDate}
              onClick={() => void setJobStatus()}
            >
              {statusBusy ? <Spinner /> : <Check size={16} />} Confirm update
            </button>
          </div>
        </Modal>
      )}
      {editJob && (
        <Modal title="Edit job details" onClose={() => setEditJob(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void api("/jobs/" + id, "PUT", editJob)
                .then(async () => {
                  setEditJob(null);
                  await load();
                  await refresh();
                })
                .catch((e) => setError(errorText(e)));
            }}
          >
            {(["title", "company", "location", "url", "deadline"] as const).map(
              (k) => (
                <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
                  <input
                    required={k === "title"}
                    className="input"
                    type={
                      k === "deadline" ? "date" : k === "url" ? "url" : "text"
                    }
                    value={editJob[k]}
                    onChange={(e) =>
                      setEditJob({ ...editJob, [k]: e.target.value })
                    }
                  />
                </Field>
              ),
            )}
            <Field label="Description">
              <textarea
                rows={8}
                className="textarea"
                value={editJob.description}
                onChange={(e) =>
                  setEditJob({ ...editJob, description: e.target.value })
                }
              />
            </Field>
            {error && <Alert>{error}</Alert>}
            <div className="modal-actions">
              <button className="btn primary">Save details</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
