export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  deadline: string;
  source: string;
  status: string;
  archived: number;
  created: string;
  updated: string;
}
export interface Profile {
  source_cv_id?: string;
  linkedin_url?: string;
  linkedin_text?: string;
  github_url?: string;
  youtube_url?: string;
  other_links?: string;
  name: string;
  facts: string;
  preferences: string;
  locations: string;
  work_mode: string;
  writing_style: string;
}
export interface Settings {
  engine: "hermes" | "claude" | "http";
  base_url?: string;
  remote_approved?: boolean;
  provider: string;
  model: string;
}
export interface Artifact {
  id: string;
  job_id: string;
  kind: string;
  title: string;
  content: string;
  created: string;
}
export interface Message {
  id: string;
  role: string;
  content: string;
  created: string;
  metadata: { document_ids?: string[]; suggested_status?: string | null };
}
export interface Run {
  id: string;
  status: string;
  stage: string;
  error: string;
}
export interface Timeline {
  id: string;
  label: string;
  created: string;
  data: { date: string; from: string; to: string; document_ids?: string[] };
}
export interface Conversation {
  job: Job | null;
  messages: Message[];
  documents: Artifact[];
  events: Timeline[];
  run: Run | null;
}
export interface Bootstrap {
  jobs: Job[];
  profile: Profile;
  settings: Settings;
  version: string;
}
export interface Catalog {
  hermes_available: boolean;
  claude_available: boolean;
  providers: { id: string; name: string; models: string[] }[];
  provider?: string;
  model?: string;
  error?: string;
}

export class ApiError extends Error {
  detail: unknown;
  constructor(message: string, detail: unknown) {
    super(message);
    this.detail = detail;
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch("/api" + path, {
    method,
    headers:
      body instanceof FormData
        ? { "X-Job-Agent": "1" }
        : { "Content-Type": "application/json", "X-Job-Agent": "1" },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res
      .json()
      .catch(() => ({ detail: "Could not reach the app. Please try again." }));
    const d = data.detail;
    throw new ApiError(
      typeof d === "string"
        ? d
        : Array.isArray(d)
          ? d.map((x: { msg: string }) => x.msg).join("; ")
          : d?.message || "Something went wrong.",
      d,
    );
  }
  return res.json();
}
export async function download(path: string, filename: string) {
  const response = await fetch("/api" + path);
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.detail || "Download failed");
  }
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export const statusLabels: Record<string, string> = {
  saved: "Saved",
  drafted: "Drafted",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  no_response: "No response",
};
export const kindLabels: Record<string, string> = {
  cv: "CV",
  cover_letter: "Cover letter",
  interview: "Interview prep",
  followup: "Follow-up",
  notes: "Notes",
};
export function errorText(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}
