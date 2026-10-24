"""Bounded public reads; resolve and pin IPs to prevent private-network requests."""
import http.client
import ipaddress
import json
import re
import socket
import ssl
import urllib.parse
import urllib.robotparser
from concurrent.futures import ThreadPoolExecutor

from bs4 import BeautifulSoup
import pycountry

from .vendor.posting_guard import guard

USER_AGENT = 'ub1979/job-agent/0.1 (personal job search)'
MAX_PAGE = 4 * 1024 * 1024


def public_address(host, port):
    try:
        records = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except OSError as exc:
        raise ValueError('This website could not be reached. Paste the job description instead.') from exc
    addresses = list(dict.fromkeys(item[4][0] for item in records))
    if not addresses or any(not ipaddress.ip_address(a).is_global for a in addresses):
        raise ValueError('Only public websites can be imported.')
    return addresses[0]


def fetch_public(url, redirects=4):
    for _ in range(redirects + 1):
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError('Use a public http or https link without login details.')
        port = parsed.port or (443 if parsed.scheme == 'https' else 80)
        if port not in (80, 443):
            raise ValueError('Only standard web ports are supported.')
        host = parsed.hostname.encode('idna').decode()
        address = public_address(host, port)
        conn = http.client.HTTPConnection(host, port, timeout=15)
        sock = socket.create_connection((address, port), timeout=15)
        if parsed.scheme == 'https':
            sock = ssl.create_default_context().wrap_socket(sock, server_hostname=host)
        conn.sock = sock
        try:
            path = urllib.parse.quote(urllib.parse.unquote(parsed.path or '/'), safe='/:%@!$&\'()*+,;=-._~')
            if parsed.query:
                path += '?' + parsed.query
            conn.request('GET', path, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json,text/html,text/plain', 'Accept-Encoding': 'identity'})
            response = conn.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                target = response.getheader('Location')
                if not target:
                    raise ValueError('The website returned an incomplete redirect.')
                url = urllib.parse.urljoin(url, target)
                continue
            if response.status >= 400:
                raise ValueError(f'The source returned HTTP {response.status}. Try later or paste the job description.')
            content = response.read(MAX_PAGE + 1)
            if len(content) > MAX_PAGE:
                raise ValueError('The page is too large. Paste just the job description.')
            return content, response.getheader('Content-Type', ''), url
        finally:
            conn.close()
    raise ValueError('The website redirected too many times.')


def clean_posting(text, mode='text'):
    cleaned, findings = guard(text, mode)
    return cleaned[:60000], findings['verdict']


def import_url(url):
    parsed = urllib.parse.urlsplit(url)
    robots_url = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, '/robots.txt', '', ''))
    try:
        robots, _, _ = fetch_public(robots_url)
    except ValueError as exc:
        if 'HTTP 404' not in str(exc):
            raise ValueError('Could not check this site’s access rules. Paste the posting instead.') from exc
    else:
        rules = urllib.robotparser.RobotFileParser()
        rules.parse(robots.decode('utf-8', errors='replace').splitlines())
        if not rules.can_fetch(USER_AGENT, url):
            raise ValueError('This website does not allow automated reading. Paste the posting instead.')
    raw, mime, final_url = fetch_public(url)
    if not any(t in mime for t in ('html', 'text/plain')):
        raise ValueError('This link is not a web page. Paste its job description instead.')
    soup = BeautifulSoup(raw, 'html.parser')
    title = soup.title.get_text(' ', strip=True) if soup.title else ''
    description, verdict = clean_posting(str(soup), 'html')
    return {'title': title[:200], 'description': description, 'url': final_url, 'verdict': verdict}


ALIASES = {'uk': 'GB', 'united kingdom': 'GB', 'usa': 'US', 'us': 'US', 'uae': 'AE', 'south korea': 'KR'}


def location_filter(value):
    value = value.strip()
    if value.lower() in ('', 'anywhere', 'worldwide', 'global'):
        return None
    if value.lower() in ALIASES:
        return ('countries', ALIASES[value.lower()].lower())
    try:
        return ('countries', pycountry.countries.lookup(value).alpha_2.lower())
    except LookupError:
        return ('cities', value.lower())


def title_terms(text):
    """Whole words, with explicit AI/ML aliases; never match 'ai' inside a word."""
    # Syndicated titles may append an agency, e.g. “... via AI Gig Scout”.
    text = re.sub(r'\bvia\b.*$', '', text, flags=re.I)
    text = re.sub(r'\bartificial intelligence\b', 'ai', text, flags=re.I)
    text = re.sub(r'\bmachine learning\b', 'ml', text, flags=re.I)
    return set(re.findall(r'[^\W_]+', text.casefold())) - {'of', 'the', 'and', 'a', 'an', 'for', 'in'}


def search_alternatives(query):
    query = re.sub(r'^\s*(?:i\s+(?:want|need|am looking for)|find me|find|looking for|search for)\s+', '', query, flags=re.I)
    alternatives = list(dict.fromkeys(p.strip(' \"\'') for p in re.split(r'\bor\b|[;,\n]', query, flags=re.I) if p.strip(' \"\'')))
    if not alternatives or any(not title_terms(p) for p in alternatives):
        raise ValueError('Enter a job title or keywords, such as Head of AI or Director of AI.')
    if len(alternatives) > 4:
        raise ValueError('Search up to four alternative titles at once.')
    return alternatives


def search_jobs(query, locations, work_mode, days, match_mode='title'):
    alternatives = search_alternatives(query)
    # One query per place implements OR even when the API combines facets with AND.
    places = list(dict.fromkeys(p.strip() for p in locations.split(',') if p.strip())) or ['']
    if len(places) > 5:
        raise ValueError('Search up to five locations at once.')

    def search(task):
        place, term = task
        params = [('q', term), ('limit', '30'), ('description_format', 'text'), ('posted_within_days', str(days))]
        if work_mode != 'any':
            params.append(('work_mode', work_mode))
        facet = location_filter(place)
        if facet:
            params.append(facet)
        url = 'https://freehire.me/api/v1/agent/jobs/search?' + urllib.parse.urlencode(params)
        try:
            raw, _, _ = fetch_public(url)
            body = json.loads(raw)
            if not isinstance(body.get('data'), list):
                raise ValueError('The source returned an unexpected response.')
            if body.get('meta', {}).get('ignored_params'):
                raise ValueError('The source did not apply all search filters. Results withheld; try again later.')
            return body['data'], None
        except (ValueError, OSError, http.client.HTTPException) as exc:
            return [], f'{place or "Worldwide"}: {str(exc)[:250]}'

    results, errors, seen, filtered = [], [], set(), 0
    with ThreadPoolExecutor(max_workers=3) as pool:
        batches = list(pool.map(search, [(place, term) for place in places for term in alternatives]))
    for jobs, error in batches:
        if error:
            errors.append(error)
        for job in jobs:
            url = job.get('url') or ''
            if not url.startswith(('https://', 'http://')) or url in seen:
                continue
            seen.add(url)
            if match_mode == 'title' and not any(title_terms(term) <= title_terms(str(job.get('title') or '')) for term in alternatives):
                filtered += 1
                continue
            description, _ = clean_posting(str(job.get('description') or ''))
            results.append({'title': str(job.get('title') or 'Untitled role')[:200], 'company': str(job.get('company') or '')[:200],
                            'location': str(job.get('location') or '')[:300], 'url': url, 'description': description,
                            'source': 'Freehire', 'posted': job.get('posted_at'), 'work_mode': job.get('work_mode'),
                            'countries': job.get('countries', []), 'deadline': ''})
    return {'jobs': results, 'errors': list(dict.fromkeys(errors)), 'source': 'Freehire',
            'queries': alternatives, 'filtered_out': filtered, 'match_mode': match_mode,
            'coverage': 'Freehire only: up to 30 candidates per title and location, then deduplicated. '
                        + ('Title matching requires every meaningful word of at least one requested title (AI and artificial intelligence are equivalent). '
                           f'{filtered} unrelated candidates hidden. ' if match_mode == 'title' else 'Broad keyword search can match descriptions and unrelated titles. ')
                        + 'This is a limited sample, not every available job. Remote eligibility varies; verify the original posting.'}
