import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  FileText,
  Globe2,
  LoaderCircle,
  Paperclip,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, errorText } from "./api";
import type {
  Message,
  Profile,
  Run,
  ProfileAction,
  ProfileSource as Source,
} from "./api";

type State = {
  messages: Message[];
  run: Run | null;
  documents: Source[];
  findings: Source[];
  profile: Profile;
};
const renderText = (text: string) => (
  <Markdown
    remarkPlugins={[remarkGfm]}
    components={{
      a: ({ children, ...props }) => (
        <a {...props} target="_blank" rel="noreferrer">
          {children}
        </a>
      ),
    }}
  >
    {text}
  </Markdown>
);

export function ProfileChat({
  revision,
  onChanged,
}: {
  revision: number;
  onChanged: () => void;
}) {
  const [data, setData] = useState<State | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [review, setReview] = useState<{
    source: Source;
    action?: ProfileAction;
    finding?: boolean;
  } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (review && node && !node.open) node.showModal();
    return () => node?.close();
  }, [review]);
  useEffect(() => {
    const node = log.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [data?.messages.length]);
  const changes = useRef(onChanged);
  changes.current = onChanged;
  const lastRun = useRef("");
  const active = data?.run?.status === "running";
  async function load() {
    const next = await api<State>("/profile/chat");
    setData(next);
    return next;
  }
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const next = await api<State>("/profile/chat");
        if (!alive) return;
        setData(next);
        const completed =
          next.run && next.run.status === "complete" ? next.run.id : "";
        if (completed && completed !== lastRun.current) {
          lastRun.current = completed;
          changes.current();
        }
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
  }, [revision]);
  async function send(value = text) {
    if (!value.trim() || active || busy) return;
    setBusy("send");
    setError("");
    try {
      await api("/profile/chat/messages", "POST", { text: value });
      setText("");
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  async function upload(files: File[]) {
    if (!files.length || busy) return;
    setBusy("upload");
    setError("");
    setNotice("");
    const errors: string[] = [];
    let count = 0;
    for (const f of files) {
      try {
        if (f.size > 10 * 1024 * 1024)
          throw new Error("Use a file smaller than 10 MB.");
        const body = new FormData();
        body.append("file", f);
        await api("/cvs", "POST", body);
        count++;
      } catch (e) {
        errors.push(`${f.name}: ${errorText(e)}`);
      }
    }
    setError(errors.join("\n"));
    setNotice(
      `${count} document${count === 1 ? "" : "s"} processed. Ask me to review them, or open a document below to approve its text. Identical files are kept once.`,
    );
    if (file.current) file.current.value = "";
    await load().catch((e) => setError(errorText(e)));
    onChanged();
    setBusy("");
  }
  async function open(source: Source, finding = false) {
    setError("");
    try {
      const detail = await api<ProfileAction>(
        `/profile/chat/${finding ? "findings" : "documents"}/${source.id}/review`,
        "POST",
      );
      setReview({ source: detail.record!, action: detail, finding });
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function action(a: ProfileAction) {
    setBusy(a.id);
    setError("");
    try {
      if (
        ["show_document", "approve_document", "approve_finding"].includes(
          a.kind,
        )
      ) {
        const detail = await api<ProfileAction>(
          "/profile/chat/actions/" + a.id,
        );
        setReview({
          source: detail.record!,
          action: detail,
          finding: a.kind === "approve_finding",
        });
      } else {
        await api("/profile/chat/actions/" + a.id, "POST");
        setNotice(
          ["update_profile", "replace_fact"].includes(a.kind)
            ? "Profile updated."
            : "Research finished. Review the findings below before adding them to your profile.",
        );
        await load();
        onChanged();
      }
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
      if (review.action && review.action.kind !== "show_document")
        await api("/profile/chat/actions/" + review.action.id, "POST");
      else if (review.finding)
        await api(
          "/profile/research/" + review.source.id + "/approve",
          "POST",
          {
            title: review.source.title,
            text: review.source.text,
            kind: "online",
            approved: true,
          },
        );
      else
        await api("/cvs/" + review.source.id, "PUT", {
          title: review.source.title,
          text: review.source.text,
          kind: review.source.kind,
          approved: true,
        });
      setNotice(`Approved for AI: ${review.source.title}`);
      setReview(null);
      await load();
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="profile-chat-layout" aria-label="Profile conversation">
      <div className="surface profile-chat-main">
        <div className="profile-chat-intro">
          <span className="soft-icon">
            <Sparkles size={22} />
          </span>
          <div>
            <h2>Let’s build your profile.</h2>
            <p>
              Upload CVs, books or publications, share LinkedIn or GitHub links,
              or tell me about yourself. We can add details as we go.
            </p>
          </div>
        </div>
        <div className="profile-chat-toolbar">
          <button
            className="btn"
            disabled={!!busy || active}
            onClick={() => file.current?.click()}
          >
            <Paperclip size={16} /> Upload CVs & documents
          </button>
          <input
            hidden
            type="file"
            multiple
            ref={file}
            aria-label="Upload profile documents"
            accept=".pdf,.docx,.txt,.md"
            onChange={(e) => void upload(Array.from(e.target.files || []))}
          />
          <span className="muted small">
            PDF, Word or text · multiple files · 10 MB each
          </span>
        </div>
        <div
          ref={log}
          className="profile-chat-messages"
          role="log"
          aria-label="Profile messages"
          aria-live="polite"
        >
          {!data?.messages.length && (
            <div className="profile-chat-welcome">
              <p>
                You can have several careers, skills and interests. Tell me what
                you have done; I’ll ask for useful details and keep your own
                statements in your profile.
              </p>
              <div className="suggestions">
                {[
                  "Show me my current profile",
                  "Review my uploaded documents",
                  "Help me add my experience and interests",
                ].map((s) => (
                  <button
                    key={s}
                    disabled={!!busy || active}
                    onClick={() => void send(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {data?.messages.map((m) => (
            <article className={"message " + m.role} key={m.id}>
              <div className="message-label">
                {m.role === "user" ? "You" : "Profile assistant"}
              </div>
              <div className="prose">{renderText(m.content)}</div>
              {!!m.metadata.saved_user_facts?.length && (
                <div className="notice success" role="status">
                  <b>Saved to your profile</b>
                  <ul>
                    {m.metadata.saved_user_facts.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {m.metadata.profile_actions?.map((a) => (
                <div className="profile-action" key={a.id}>
                  <div>
                    <b>{a.label}</b>
                    {a.kind === "search_web" || a.kind === "review_link" ? (
                      <>
                        <p className="profile-action-target">{a.target}</p>
                        <small>
                          {a.kind === "search_web"
                            ? "Only this query is sent to public search. Results need your approval."
                            : "Read this public page. Its contents need your approval."}
                        </small>
                      </>
                    ) : a.kind === "replace_fact" ? (
                      <p>
                        Current: {a.target}
                        <br />
                        Change to: {a.value || "Remove this fact"}
                      </p>
                    ) : a.kind === "update_profile" ? (
                      <p>
                        {a.field.replaceAll("_", " ")}: {a.value}
                      </p>
                    ) : null}
                  </div>
                  <button
                    className="btn small"
                    disabled={!!busy || a.status === "complete"}
                    onClick={() => void action(a)}
                  >
                    {a.status === "complete" ? (
                      <>
                        <Check size={15} /> Done
                      </>
                    ) : a.kind === "search_web" ? (
                      <>
                        <Globe2 size={15} /> Search internet
                      </>
                    ) : a.kind === "review_link" ? (
                      "Read public link"
                    ) : ["update_profile", "replace_fact"].includes(a.kind) ? (
                      "Save this detail"
                    ) : (
                      "Review document"
                    )}
                  </button>
                </div>
              ))}
            </article>
          ))}
          {active && (
            <p className="working" role="status">
              <LoaderCircle className="spin" size={16} />
              {data?.run?.stage}…
            </p>
          )}
          {data?.run &&
            ["failed", "interrupted", "cancelled"].includes(
              data.run.status,
            ) && (
              <div className="notice error">
                {data.run.error ||
                  "Reply stopped. You can send another message."}
              </div>
            )}
        </div>
        {notice && (
          <p className="notice success" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <form
          className="profile-chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="profile-message">
            Profile message
          </label>
          <textarea
            id="profile-message"
            className="textarea"
            rows={3}
            maxLength={16000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tell me about your experience, paste a link, or ask me to review a document…"
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
          <div className="profile-composer-bottom">
            <small>
              Ask for online research when useful. You review the query or link
              before it runs.
            </small>
            {active ? (
              <button
                type="button"
                className="btn"
                onClick={() =>
                  void api("/runs/" + data!.run!.id + "/cancel", "POST")
                    .then(load)
                    .catch((e) => setError(errorText(e)))
                }
              >
                <Square size={15} /> Stop
              </button>
            ) : (
              <button
                className="btn primary"
                aria-label="Send profile message"
                disabled={!!busy || !text.trim()}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <ArrowUp size={17} />
                )}{" "}
                Send
              </button>
            )}
          </div>
        </form>
      </div>
      <aside className="profile-chat-context">
        <section className="surface form-panel">
          <h3>Your profile, so far</h3>
          <p className="muted small">
            Your own statements are trusted. Each application uses the details
            relevant to that role.
          </p>
          {data?.profile.name && <b>{data.profile.name}</b>}
          <div className="profile-saved-facts">
            {data?.profile.self_reported_facts ? (
              renderText(data.profile.self_reported_facts)
            ) : (
              <p className="muted small">
                New experience, interests and skills you tell me will appear
                here.
              </p>
            )}
          </div>
          <button
            className="text-button"
            disabled={!!busy || active}
            onClick={() =>
              void send(
                "Summarise my current profile, including experience, interests and anything missing.",
              )
            }
          >
            Explain my full profile
          </button>
        </section>
        <section className="surface form-panel">
          <h3>
            Documents{" "}
            <span className="muted">({data?.documents.length || 0})</span>
          </h3>
          <p className="muted small">
            {data?.documents.filter((d) => d.approved).length || 0} approved for
            AI · review the rest below
          </p>
          {data?.documents.map((d) => (
            <button
              key={d.id}
              className="profile-source"
              onClick={() => void open(d)}
            >
              <FileText size={17} />
              <span>
                <b>{d.title}</b>
                <small>
                  {d.approved ? "Approved for AI" : "Awaiting your approval"}
                </small>
              </span>
            </button>
          ))}
          {!data?.documents.length && (
            <p className="muted small">
              Start with your academic or industry CV. You can add publications,
              books and more.
            </p>
          )}
        </section>
        {!!data?.findings.length && (
          <section className="surface form-panel">
            <h3>Online findings to review</h3>
            {data.findings.map((f) => (
              <button
                className="profile-source"
                key={f.id}
                onClick={() => void open(f, true)}
              >
                <Globe2 size={17} />
                <span>
                  <b>{f.title}</b>
                  <small>Not yet added · review and approve</small>
                </span>
              </button>
            ))}
          </section>
        )}
      </aside>
      {review && (
        <dialog
          ref={dialog}
          className="modal profile-review-dialog"
          aria-labelledby="profile-review-title"
          onCancel={(e) => {
            e.preventDefault();
            if (!busy) setReview(null);
          }}
        >
          <div className="panel-heading">
            <h2 id="profile-review-title">{review.source.title}</h2>
            <button
              className="icon-button"
              aria-label="Close profile document"
              disabled={!!busy}
              onClick={() => setReview(null)}
            >
              <X size={20} />
            </button>
          </div>
          {(review.source.url || review.source.source_url) && (
            <a
              href={review.source.url || review.source.source_url}
              target="_blank"
              rel="noreferrer"
            >
              View source
            </a>
          )}
          <p className="muted small">
            Review the extracted text. Approval lets the assistant use this
            source for relevant jobs.
          </p>
          <pre className="profile-document-text">{review.source.text}</pre>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <div className="profile-review-actions">
            <button
              className="btn"
              disabled={!!busy}
              onClick={() => setReview(null)}
            >
              Close
            </button>
            {!review.source.approved && (
              <button
                className="btn primary"
                disabled={!!busy || !review.source.text?.trim()}
                onClick={() => void approve()}
              >
                <Check size={16} /> Approve for AI
              </button>
            )}
            {!!review.source.approved && (
              <span className="notice success">Approved for AI</span>
            )}
          </div>
        </dialog>
      )}
    </section>
  );
}
