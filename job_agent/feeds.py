"""Read a user-selected public RSS/Atom feed without credentials or private networking."""
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit, urljoin
from defusedxml import ElementTree
from .sources import fetch_public, clean_posting, title_terms, search_alternatives


def feed_jobs(url, query, match_mode='title', days=30):
    raw, _, final_url = fetch_public(url)
    try:
        root = ElementTree.fromstring(raw)
    except Exception as exc:
        raise ValueError('The feed could not be read as RSS or Atom.') from exc
    atom = '{http://www.w3.org/2005/Atom}'
    if root.tag not in ('rss', 'RDF', '{http://www.w3.org/1999/02/22-rdf-syntax-ns#}RDF', atom + 'feed'):
        raise ValueError('Use an RSS or Atom feed URL, not a job search web page.')
    entries = root.findall('.//item') + root.findall(atom + 'entry')
    alternatives = [title_terms(t) for t in search_alternatives(query)]
    jobs, filtered = [], 0
    for entry in entries[:200]:
        def text(name):
            return entry.findtext(name) or entry.findtext(atom + name) or ''
        title = text('title').strip()
        link = text('link')
        if not link:
            for candidate in entry.findall(atom + 'link'):
                if candidate.get('rel', 'alternate') == 'alternate':
                    link = candidate.get('href', '');break
        link = urljoin(final_url, link.strip())
        p = urlsplit(link)
        if not title or p.scheme not in ('http', 'https') or not p.hostname or p.username or p.password:
            continue
        desc = text('description') or text('summary') or text('content')
        description, _ = clean_posting(desc, 'html')
        terms = title_terms(title if match_mode == 'title' else title + ' ' + description)
        if not any(alt <= terms for alt in alternatives):
            filtered += 1;continue
        date = text('pubDate') or text('published') or text('updated')
        posted = None
        try:
            when = parsedate_to_datetime(date) if ',' in date else datetime.fromisoformat(date.replace('Z', '+00:00'))
            when = when.replace(tzinfo=timezone.utc) if when.tzinfo is None else when
            if (datetime.now(timezone.utc) - when).days > days:
                continue
            posted = when.isoformat()
        except (ValueError, TypeError, OverflowError):
            pass
        jobs.append({'title': title[:200], 'company': '', 'url': link, 'description': description,
                     'location': 'Check feed posting for location eligibility', 'source': 'RSS · ' + (urlsplit(final_url).hostname or ''),
                     'posted': posted, 'work_mode': '', 'deadline': '', 'verification': 'feed'})
    return {'jobs': jobs, 'filtered_out': filtered}
