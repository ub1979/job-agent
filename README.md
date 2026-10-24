# Job Agent

A separate, local job-search app with Appling's familiar conversational interface and AI connections. Save opportunities, discuss them naturally, prepare documents, and keep the exact application history together.

## Start

Requires macOS or Linux, Python 3.11+, [uv](https://docs.astral.sh/uv/), and Node.js 22.12+ (or 24+). This initial release was tested on macOS. Windows launch scripts are not included.

```bash
./start.sh
```

On macOS you can also double-click **Start Job Agent.command**. The launcher installs locked dependencies, builds the screen, starts the local service and opens **http://127.0.0.1:9210**. Stop it with `./stop.sh`. Use `./start.sh 9212` to choose another port. Logs and the process record live under the ignored `.run/` folder.

First launch needs internet to install dependencies. Later launches use the installed dependencies and rebuild the interface. If your system Python is unsuitable, set `JOB_AGENT_PYTHON` to a Python 3.11+ executable before launching.

## AI connections

Open **AI settings** and use **Test connection**. That button makes a small real model request and uses the selected provider's quota.

- **Appling connections:** reads the linked providers from an existing Appling installation. By default, Job Agent finds an `Appling` directory beside this repository. For another location, set `JOB_AGENT_APPLING_ROOT=/path/to/Appling` before starting. That folder must have its working `.venv/bin/python`. Choose a provider and model, or leave both blank to follow Appling's current choice. Settings are saved only in Job Agent; Appling's configuration is never changed. New provider sign-ins are managed in Appling.
- **Claude Code:** uses the `claude` executable and its existing subscription sign-in. Install/sign in using Claude Code first. Job Agent disables inherited API-key routes for this option so billing does not silently switch to an API key. Recent Claude Code versions supporting `--no-session-persistence`, `--tools`, and `--strict-mcp-config` are required.

The interface and data storage are independent of Appling. The Appling connection option depends on its runtime; the Claude Code option can run without Appling. No AI engine or paid subscription is bundled. Models vary in quality, speed, context limits and structured-output reliability.

## What is included

- Appling-inspired light/dark interface, normal chat, a general search conversation and separate job conversations.
- New jobs from pasted text or readable public links; blocked sites fall back to pasted descriptions.
- Active/archived jobs, editable metadata, deadlines and explicit status updates.
- Shared career profile; PDF, Word, Markdown or text CV import with review before saving.
- Multi-source discovery: Freehire plus public web search across job boards and employer career sites. Choose multiple cities/countries or worldwide, with visible source status and the actual search queries.
- AI help with fit, CVs, cover letters, interview preparation and follow-up drafts. Drafts receive a separate factual editing pass. Both passes use the selected model; the second pass is not a guarantee of correctness.
- Versioned documents with Markdown, Word and text-extractable PDF export; manual editing creates a new version.
- Recording an application as **Applied** freezes its posting, profile and latest document IDs. Later drafts do not replace submitted documents. Repeat applications have unique IDs.
- Durable SQLite chat and job records; cancelled and interrupted runs have explicit states. Only one run per conversation and two model requests concurrently.
- Export of profile, jobs, conversations, submission snapshots, document versions and a CSV tracker as a ZIP. This is a portable export; an in-app restore/import flow is not included yet.

### CV library and LinkedIn

Upload several PDF, DOCX, TXT or Markdown CVs together in **My profile → Your CV library**, or drag files into the upload area (10 MB per file). Each original and its extracted text stay in local SQLite storage. Identical file content is kept once; failed files do not discard successful uploads. Search the library by name, review/edit its text, rename it, or download the original. **Use as profile** copies the reviewed CV into the profile form; **Save profile** applies that snapshot to future conversations. Later library edits do not silently replace it. Other stored CVs are not automatically sent to the model. ZIP export includes library records and originals.

Add a LinkedIn profile URL and paste its About/Experience text in the career profile, or upload a LinkedIn-exported PDF to the library. The URL is a reference, not an automatic scrape or login. The assistant receives the supplied profile text; conflicts between sources should be clarified rather than combined into fabricated facts.

## Data and scope

On macOS, data is stored in `~/Library/Application Support/Job Agent/`. On Linux it is under `$XDG_DATA_HOME/job-agent` or `~/.local/share/job-agent`. Override with `JOB_AGENT_DATA_DIR`. Keep that directory outside this Git repository. Back up the entire directory while the app is stopped for a restorable local backup.

Personal data, runtime files and credentials are excluded from Git. The app does not store or expose provider keys. Local database files have restricted permissions but are not encrypted by the app. Your selected cloud AI provider receives relevant profile facts, posting text, recent messages and document drafts. The app keeps full chat history; model requests include up to 40 recent messages within a character budget. Provider/runtime logging policies still apply.

The server binds only to `127.0.0.1`. It is a single-user local app, without remote-user authentication. **Do not expose it through a public tunnel or change it to listen on your network.** Mutations require a same-origin custom header; public posting fetches reject private network addresses and pin the validated address across the connection. External content is treated as data, and the generation adapters disable agent tools. App code controls fetches, status writes and document creation.

## Current limits

- Search combines **Freehire and public web discovery** (DDGS using Google/Yahoo/Bing/DuckDuckGo/Brave search backends, no new API key required). Web queries target job boards including LinkedIn, Indeed, Glassdoor, Reed and Totaljobs, and employer sites including Greenhouse, Lever, Ashby, Workday and SmartRecruiters, plus unrestricted company-careers queries. These are searches of public indexes, not direct integrations or logged-in access to those websites. Each source group and its exact queries/status are visible. Search engines can fail or rate-limit; failures are reported separately from a successful empty response. A compact summary leads to expandable source diagnostics; repeated rejected web URLs are counted once. This cannot cover every site or vacancy. Web leads retain an unverified-excerpt notice when saved; open status, posting dates, location and work mode need checking on the original posting. The date filter only applies to Freehire. Search terms/location preferences are sent to the search services; profile/CV content is not sent for discovery. The search engine uses an English locale for compatibility, with no country filter; user locations guide queries. Enter alternative titles with “or”, commas, or semicolons (up to four). Freehire retrieves up to 30 candidates per title/location; web search uses three scoped queries per title and location, expanding country aliases such as UK and UAE into full names (up to 12 hits each, three concurrent workers, 25-second worker deadlines). Results are deduplicated by canonical URL, retaining job IDs and dropping tracking parameters. The same vacancy advertised at different URLs can still appear twice. Default title matching requires all meaningful words of at least one alternative in the title; AI/artificial intelligence and ML/machine learning are equivalent. For example, “Head of AI or Director of AI” excludes unrelated heads/directors and AI engineers. Use explicit broad keyword mode to search descriptions or skills. This deterministic filter is not a semantic fit score and can miss differently worded titles; coverage is a limited sample. The UI reports discarded candidates and source errors. Any other posting can still be pasted/imported.
- “Remote” does not guarantee worldwide eligibility; the user and assistant must check the posting's actual location/work-permission requirements.
- There is no automatic application submission, email integration, scheduled monitoring, or browser form filling. Recording a status does not send anything.
- Generated materials always need human review. A second AI pass can miss unsupported claims. Fit assessments are not hiring probabilities.
- PDF export uses an embedded Latin-script font with a text-layer check, not a guarantee against every ATS. For unsupported characters, PDF export explicitly recommends Word instead of silently dropping text. Word supports international content through the reader's installed fonts. Scanned PDF OCR is not included.
- The importer respects robots rules, limits redirects and page size, and does not bypass logins/CAPTCHAs. It may import navigation text; review the resulting posting.
- The app runs while its local service is running. It does not keep working through machine shutdown.

## Development and verification

```bash
uv sync --frozen --python "$(command -v python3)"
cd web
npm ci
npm run build
cd ..
.venv/bin/python -m pytest -q
cd web
npx playwright install chromium
npx playwright test
```

Browser tests use a separate disposable database, fictional candidate details and a fake model. They do not read the user's career data or consume model credits. They cover CV import/profile setup, job creation, chat, document revision/download, submission snapshots, archive/restore, theme and small-screen layout. Backend tests cover those state transitions plus cancellation, restart recovery, CSV formula escaping, validation and private-address rejection.

An optional **live** check uses the configured AI and consumes quota, with fictional facts only:

```bash
.venv/bin/python -m scripts.smoke_live
```

For interface development, run `.venv/bin/python -m job_agent` and `cd web && npm run dev`. Mutating requests should use the production same-origin screen; the Vite proxy must preserve the browser origin if you change its configuration.

## Architecture and attribution

`job_agent/server.py` provides a FastAPI local API. `store.py` owns transactional records and immutable document revisions. `ai.py` coordinates bounded generation and independent review through an isolated subprocess. `hermes_worker.py` reuses Appling's existing provider resolution without copying credentials. `sources.py` owns public job fetching/search; `documents.py` owns extraction and export. `web/src` contains the React interface.

The visual foundation is adapted from Appling's `lyra_lite` theme (Hermes-derived, MIT). Job application workflow design is informed by [ai-job-search](https://github.com/ai-job-search-dev/ai-job-search), reviewed at commit `e16acee3abdaae57f8026789338a3c6eebf4608b`. Its `posting_guard.py` and `page_decode.py` are vendored with their MIT license. Source records and notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The rest is a dedicated local job application, not a wholesale fork of either runtime.
