"""Combine structured jobs with clearly labelled public search-index leads.

Search engines do not verify open status, dates, work mode or geography. Never
turn those snippets into purportedly verified postings or silently drop failures.
"""
from concurrent.futures import ThreadPoolExecutor
import html
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from .sources import clean_posting, location_filter, search_alternatives, search_jobs, title_terms

WEB_GROUPS = {
    'Public web / company careers': 'jobs',
    'Job boards via web index': '(site:linkedin.com/jobs/view OR site:indeed.com/viewjob OR site:glassdoor.com/job-listing OR site:reed.co.uk/jobs OR site:totaljobs.com/job)',
    'Employer hiring sites via web index': '(site:greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com OR site:myworkdayjobs.com OR site:jobs.smartrecruiters.com)',
}


def web_search(query):
    try:
        result = subprocess.run([sys.executable, str(Path(__file__).with_name('web_worker.py'))],
                                input=json.dumps({'query': query}), capture_output=True, text=True,
                                timeout=25, check=True)
        data = json.loads(result.stdout)
        if data.get('error'):
            raise ValueError(data['error'])
        return data['hits']
    except (subprocess.SubprocessError, OSError, ValueError, KeyError) as exc:
        raise ValueError('Public web search unavailable or timed out. Try again later.') from exc


def canonical_url(url):
    try:
        p = urlsplit(url)
        if p.scheme not in ('http', 'https') or not p.hostname or p.username or p.password:
            return ''
        host = p.hostname.lower().removeprefix('www.')
        if host == 'linkedin.com' or host.endswith('.linkedin.com'):
            match = re.search(r'/jobs/view/(?:.*-)?(\d+)/?$', p.path)
            if match:
                return f'https://www.linkedin.com/jobs/view/{match[1]}'
        query = [(k, v) for k, v in parse_qsl(p.query) if not k.lower().startswith('utm_')
                 and k.lower() not in {'trk', 'trackingid', 'ref', 'source', 'refid'}]
        return urlunsplit((p.scheme, p.netloc.lower(), p.path.rstrip('/'), urlencode(sorted(query)), ''))
    except ValueError:
        return ''


def is_job_lead(title, url):
    """Exclude obvious directories/articles; remaining hits still need verification."""
    p = urlsplit(url)
    host, path = p.hostname or '', p.path.lower()
    # Search engines can include ads or ignore site: operators. Never present
    # search/ad redirects or arbitrary product/article pages as job postings.
    if any(host == domain or host.endswith('.' + domain) for domain in
           ('bing.com', 'google.com', 'duckduckgo.com', 'search.yahoo.com', 'search.brave.com')):
        return False
    if host == 'linkedin.com' or host.endswith('.linkedin.com'):
        return '/jobs/view/' in path
    if any(part in path for part in ('/jobs/search', '/job-search', '/salaries', '/salary', '/blog/', '/advice/', '/news/', '/q-')):
        return False
    if re.search(r'\b\d+[,+]?\s+.*\bjobs\b|\b(?:salary|salaries|how to become)\b', title, re.I):
        return False
    if re.search(r'\bjobs\s+(?:in|near|available)\b', title, re.I):
        return False
    if re.search(r'\bjobs\s*[-–|]|\bvacancies\b', title, re.I):
        return False
    hiring_host = any(part in host for part in ('jobs.', 'careers.', 'greenhouse.io', 'myworkdayjobs.com', 'apply.workable.com'))
    hiring_path = re.search(r'/(?:jobs?|careers?|positions?|requisitions?|vacanc[^/]*|opportunities|apply|viewjob)(?:/|[-?]|$)', path)
    return bool(path.strip('/') and (hiring_host or hiring_path))


def web_tasks(alternatives, locations, work_mode):
    places = [p.strip() for p in locations.split(',') if p.strip() and location_filter(p)]
    where = (' (' + ' OR '.join('"' + p.replace('"', '') + '"' for p in places) + ')') if places else ''
    arrangement = '' if work_mode == 'any' else ' ' + {'onsite': '"on site"'}.get(work_mode, work_mode)
    tasks = []
    for term in alternatives:
        term = term.replace('"', '')
        phrase = f'"{term}"'
        for label, scope in WEB_GROUPS.items():
            tasks.append((label, f'{phrase}{where}{arrangement} {scope}'))
    return tasks


def discover_jobs(query, locations, work_mode, days, match_mode='title', sources='all'):
    alternatives = search_alternatives(query)
    if len([p for p in locations.split(',') if p.strip()]) > 5:
        raise ValueError('Search up to five locations at once.')
    jobs, errors, reports, seen = [], [], [], set()
    filtered = 0

    def add(job):
        key = canonical_url(job['url'])
        if key and key not in seen:
            seen.add(key)
            jobs.append(job)

    if sources in ('all', 'freehire'):
        batch = search_jobs(query, locations, work_mode, days, match_mode)
        filtered += batch['filtered_out']
        errors.extend(batch['errors'])
        reports.append({'name': 'Freehire', 'status': 'partial' if batch['errors'] else 'searched',
                        'matches': len(batch['jobs']), 'queries': batch['queries']})
        for job in batch['jobs']:
            add(job)

    if sources in ('all', 'web'):
        def search(task):
            label, text = task
            try:
                return label, text, web_search(text), None
            except ValueError as exc:
                return label, text, [], str(exc)
        with ThreadPoolExecutor(max_workers=3) as pool:
            batches = list(pool.map(search, web_tasks(alternatives, locations, work_mode)))
        for label, text, hits, error in batches:
            matches = 0
            if error:
                errors.append(f'{label}: {error}')
            for hit in hits:
                url = str(hit.get('href') or hit.get('url') or '')
                key = canonical_url(url)
                if not key or key in seen:
                    continue
                title = html.unescape(str(hit.get('title') or ''))
                # Ignore publisher/company text after “at” or a vertical bar.
                role = re.split(r'\s+(?:at|bei|chez)\s+|\s*\|\s*', title, maxsplit=1, flags=re.I)[0]
                if not is_job_lead(title, key) or (match_mode == 'title' and not any(title_terms(t) <= title_terms(role) for t in alternatives)):
                    filtered += 1
                    continue
                snippet, _ = clean_posting(str(hit.get('body') or hit.get('description') or ''))
                host = urlsplit(url).hostname or 'Web'
                add({'title': title[:200], 'company': '', 'location': 'Verify on original posting',
                     'url': url, 'source': f'Web index · {host}', 'posted': None, 'work_mode': '',
                     'countries': [], 'deadline': '', 'verification': 'web_lead',
                     'description': 'PUBLIC WEB SEARCH EXCERPT — not a verified full posting. '
                                    'Confirm the role is still open, posting date, location and work arrangement on the original page.\n\n' + snippet})
                matches += 1
            reports.append({'name': label, 'status': 'unavailable' if error else 'searched',
                            'matches': matches, 'queries': [text]})
    web_note = (' Web results are search-index leads, not direct searches inside each site. '
                'Your location and work preference guide the query; dates, eligibility and open status remain unverified. '
                'The date filter applies only to Freehire.' if sources != 'freehire' else '')
    return {'jobs': jobs, 'errors': list(dict.fromkeys(errors)), 'source': 'Multiple sources' if sources == 'all' else sources,
            'source_reports': reports, 'filtered_out': filtered, 'queries': alternatives, 'match_mode': match_mode,
            'coverage': f'{filtered} unrelated candidates hidden. Results deduplicated by posting URL. '
                        'Limited search coverage; absence of results does not mean no jobs exist.' + web_note}
