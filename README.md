# Job Agent

A separate, local job-search app with Appling's familiar conversational interface and AI connections. Save opportunities, discuss them naturally, prepare documents, and keep the exact application history together.

## Start

Supports Windows, macOS and Linux. Install [uv](https://docs.astral.sh/uv/) and Node.js 22.12+ (or 24+). The Windows launcher asks uv to supply Python 3.13; macOS/Linux use Python 3.11+ on PATH. Windows checks run in GitHub Actions.

```bash
./start.sh
```

On macOS you can also double-click **Start Job Agent.command**. The launcher installs locked dependencies, builds the screen, starts the local service and opens **http://127.0.0.1:9210**. Stop it with `./stop.sh`. Use `./start.sh 9212` to choose another port. Logs and the process record live under the ignored `.run/` folder.

First launch needs internet to install dependencies. Later launches use the installed dependencies and rebuild the interface. If your system Python is unsuitable, set `JOB_AGENT_PYTHON` to a Python 3.11+ executable before launching.

### Windows

Double-click `start.bat` and stop with `stop.bat`. From Command Prompt, use:

```bat
cd /d "C:\path with spaces\job-agent"
start.bat
```

Use `start.bat 9212` for another port. Scripts work relative to their own folder; there are no hardcoded Mac paths. Windows records live in `%LOCALAPPDATA%\Job Agent` (or `%USERPROFILE%\AppData\Local\Job Agent`). File uploads use the Windows file picker; full local paths such as `C:\Users\Name\Documents\CV.docx` are stripped to the filename and never stored as document metadata. No manual upload-folder path is needed. Windows stop terminates this app's verified process tree; an interrupted AI request is marked on the next launch.

## AI connections

Open **AI settings** and use **Test connection**. That button makes a small real model request and uses the selected provider's quota.

- **Appling connections:** reads the linked providers from an existing Appling installation. By default, Job Agent finds an `Appling` directory beside this repository. For another location, set `JOB_AGENT_APPLING_ROOT=/path/to/Appling` before starting. That folder must have its working `.venv/bin/python` (macOS/Linux) or `.venv\Scripts\python.exe` (Windows). Choose a provider and model, or leave both blank to follow Appling's current choice. Settings are saved only in Job Agent; Appling's configuration is never changed. New provider sign-ins are managed in Appling.
- **Claude Code:** uses the `claude` executable and its existing subscription sign-in. Install/sign in using Claude Code first. Job Agent disables inherited API-key routes for this option so billing does not silently switch to an API key. Recent Claude Code versions supporting `--no-session-persistence`, `--tools`, and `--strict-mcp-config` are required.

The interface and data storage are independent of Appling. The Appling connection option depends on its runtime; the Claude Code and AI-server options can run without Appling. No AI engine or paid subscription is bundled. Models vary in quality, speed, context limits and structured-output reliability.

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

Upload several PDF, DOCX, TXT or Markdown CVs together in **My profile → Your CV library**, or drag files into the upload area (10 MB per file). Each original and its extracted text stay in local SQLite storage. Identical file content is kept once; failed files do not discard successful uploads. Search the library by name, review/edit its text, rename it, or download the original. **Use as profile** copies the reviewed CV into the profile form; **Save profile** applies that snapshot to future conversations. Later library edits do not silently replace it. Review each source, choose its document type and click **Approve for AI use** at the top of its review window to make it available across jobs. Unapproved library sources stay out of AI requests. Approved sources contribute attributed excerpts selected for the current job; long libraries may exceed the context budget. Academic applications prioritise academic CVs, publications and books, while industry applications prioritise relevant industry evidence. Both generation and factual review receive the same evidence. The assistant must ask about conflicting facts and cannot assume authorship merely because a document was uploaded. ZIP export includes library records and originals.

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

### Career evidence and online enrichment

The career library accepts CVs, publications, books, portfolios, certificates and other text-based documents (10 MB/file; up to 300 PDF pages and 300,000 extracted characters). **Analyse approved information** reviews your saved profile and approved source excerpts with your selected AI provider, reporting strengths, gaps and conflicts without rewriting the profile. Each job automatically receives job-relevant excerpts from approved sources. Source text is evidence, not executable instructions. Existing uploads require review/approval before being included; the saved career profile remains available as before.

Online enrichment is optional: open the public-information section, enter the exact public search query and approve transmitting it. Profile documents are not sent to the search service. Findings remain separate from career evidence until you review identity and text and click **Approve and add to library**. Approved findings preserve the source URL. This imports search excerpts, not a verified full-page biography; namesakes and inaccurate claims must be checked by the user. Revoke a source by clicking **Remove AI approval** in its review window. Previously saved profile facts and generated documents are snapshots and are not automatically erased by revocation.

### Search continuity and profile-led discovery

Opening a result keeps the search page mounted, including filters, results, expanded descriptions, sort and scroll position. Jobs opened there offer **Back to search results**. The last completed search and its filters/results are saved locally in SQLite and restored after a page refresh; it is a snapshot, so search again for current listings or updated profile matching. Sort preference is saved in the browser.

Use **Suggest roles from my profile** to ask the selected AI connection for up to four target titles and an explanation based on saved profile facts and approved library excerpts. Review/edit the titles, then click **Find jobs**. This sends approved career context to the selected AI provider; job sources receive search terms and location filters rather than the CV itself.

Sort by **Best fit to my profile**, **Newest posted** or **Source order**. Best-fit order is a local text relevance calculation using title/description overlap with approved evidence, title weighting and stated role preferences; shared terms are shown. It does not verify qualifications, eligibility, authorship or predict hiring outcomes. Web leads may have only a snippet and no posting date. Discuss a saved job for deeper AI assessment. No evidence means no meaningful fit score; approve sources or save career facts and search again.

## License

Original project-owner material is designated **CC BY-NC-ND 4.0** for
noncommercial use, with education and research as the intended audience.
Attribution is required; sharing adapted versions is not licensed.
See [LICENSE](LICENSE) and [licensing scope and exceptions](LICENSING.md).
Third-party licenses and earlier grants remain in effect.
This release is source-available, not OSI open source.

### AI servers on this or another computer

In **AI settings → AI server / another PC**, **Detect on this PC** checks model-list endpoints at loopback ports 11434 (Ollama), 1234 (LM Studio) and 8080. The service must already be running; model discovery is not installation or a successful inference test. Enter a different OpenAI-compatible base URL ending in `/v1` to connect to another server. For a non-loopback address, approve the displayed destination before listing models, then select a chat model, test the connection and save. Relevant approved career context is sent there when you use AI features. Discovery sends no career documents. There is no LAN sweep or automatic firewall/server configuration.

The other PC must explicitly serve its AI API at a reachable LAN address and permit this device. Consult [Ollama compatibility](https://docs.ollama.com/api/openai-compatibility) or [LM Studio server documentation](https://lmstudio.ai/docs/developer). Localhost on one PC is not localhost on another. An HTTPS endpoint is appropriate where transport confidentiality is needed. For an authenticated endpoint, set `JOB_AGENT_AI_API_BASE` to that exact base URL and `JOB_AGENT_AI_API_KEY` to its key in your local environment before launching. Keys are used only for that matching endpoint, not forwarded to detected peers, and are not saved in SQLite or Git. Windows Claude Code connections require the native executable rather than a batch-file wrapper.

### Job-board login and RSS feeds

Search currently combines public indexes and Freehire. **Search directly on LinkedIn or Indeed** opens each board in your browser for each requested location. You can sign in there normally; Job Agent does not collect passwords, copy browser sessions or automatically read logged-in results. Bring a chosen posting back through **New job**, using a link or pasted text. This is not an authenticated scraping integration.

If a board offers public RSS/Atom, expand **Include a public RSS or Atom job feed** and enter the feed URL. For example, [We Work Remotely](https://weworkremotely.com/remote-job-rss-feed) publishes `https://weworkremotely.com/remote-jobs.rss`. Feed jobs join the same results and fit sort, keep their original attribution/links, are filtered by title (or broad keywords) and known posting dates, and deduplicate by URL. Location/work-mode requirements and unknown dates still need review. Private-network feeds, credentials in URLs and XML entities are refused. LinkedIn's [XML feeds](https://learn.microsoft.com/en-us/linkedin/talent/job-postings/xml-feeds-faq?view=li-lts-2026-04) concern employer job submission, not a public job-search RSS export; its [automation policy](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions) also applies to signed-in access.

### GitHub, YouTube and portfolio evidence

Save your GitHub, YouTube and other public links in **My profile**. In **Review a public GitHub, YouTube or portfolio link**, enter a public URL and approve reading it. A GitHub profile read returns public biography metadata and up to 30 recently updated public repository summaries; a repository read returns metadata and a bounded README excerpt. It does not review the whole codebase or establish your personal authorship. A YouTube video read uses public oEmbed metadata only: it does not watch the video, fetch a transcript, verify credits, or enumerate a whole channel. For channel links that do not expose readable metadata, supply individual public video links or paste descriptions/transcripts and your contribution. Other public web pages use the bounded importer and its access checks.

All retrieved material remains a pending finding until **Approve and add to library**. Confirm identity, accuracy and your role before approving it. The assistant now asks for relevant public project/portfolio/production-credit evidence and directs you to this workflow instead of saying the whole app cannot open links. Browsing is app-controlled, not an autonomous tool inside drafting chat.

### Built-in application browser — no extension or pairing codes

Select a job and choose **Prepare application** in its sidebar. Confirm the selected generated CV, optional cover letter and application URL, then choose **Open browser & prepare**. Job Agent opens a dedicated browser window using installed Chrome or Edge (with bundled Playwright Chromium as a fallback where already available). Browser control runs through the Node/Playwright runtime already installed by the app's normal setup; Appling is not required. No browser extension, Developer mode or pairing-code copying is needed. Contact details are remembered locally for future applications.

Recognised application fields and CV/cover-letter attachments are prepared automatically on the expected site. For redirects, login, Apply steps or multi-step forms, handle navigation in the visible browser yourself. Back in Job Agent, **Refresh browser status**, check the displayed destination, then choose **Fill current application page**. A changed page is rejected until you refresh its status. The fill engine preserves existing answers/attachments, leaves screening questions and declarations to you, and never clicks Submit or calls a submission API. Some sites autosave edits/uploads. Review everything and submit yourself. Custom widgets and embedded frames may still require manual input.

The browser has its own persistent profile under the private application-data folder's `application-browser/`. It remembers sign-ins you perform in that window; it does not attach to your personal browser's default profile or borrow Appling's sessions. Sign in yourself once where needed. Browser history/cookies and application records stay local and are excluded from Git. Stopping Job Agent closes the managed browser, so finish or save site drafts before stopping. Requests are restricted to fixed open/status/fill/selected-text operations; the AI drafting agent cannot execute arbitrary browser commands. The old extension is retained only as an optional legacy alternative.

### LinkedIn information visible after sign-in

Enter the profile URL in My profile's link section and approve opening it. Choose **Open profile browser**, sign in yourself, expand relevant sections and select the text you want to bring over, including certificates. Back in My profile, refresh the profile browser status if you navigated, then choose **Import selected text**. Review the pending finding and approve it if accurate. There are no pairing codes or extension-install steps. It copies only your selection and does not crawl hidden sections or assume a stored URL proves a certificate. Public-link review and PDF/pasted text remain available.
