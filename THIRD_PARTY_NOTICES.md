# Third-party notices

## Appling / Hermes visual foundation

`web/src/appling-theme.css` is copied from the local Appling checkout's `lyra_lite/ui/src/theme.css` at commit `ff555a169` and used as the visual base. The inherited MIT notice is preserved in `web/LICENSE.appling` (Copyright 2025 Nous Research). Job-specific UI and styling are new. Appling's installed runtime is used as an optional external dependency, not copied into this repository.

## AI Job Search

Source: https://github.com/ai-job-search-dev/ai-job-search

Reviewed commit: `e16acee3abdaae57f8026789338a3c6eebf4608b`.

`job_agent/vendor/posting_guard.py` and `job_agent/vendor/page_decode.py` are copied from its `tools/` directory. Its MIT notice is retained in `job_agent/vendor/LICENSE.ai-job-search` (Copyright 2026 Mads Lorentzen). The application's source adapters and review workflow are informed by that project's public specifications. We do not copy personal candidate profiles or the whole repository's instruction set.

## Dependencies and fonts

Python dependencies and their resolved versions are in `uv.lock`; frontend dependencies are in `web/package-lock.json`. Each retains its own license. PDF export uses the Bitstream Vera fonts distributed with ReportLab under their accompanying license, without copying font files into this repository. The visual base requests Inter and JetBrains Mono from Google Fonts and falls back to system fonts when unavailable.
