"""Read public profile links only after UI consent; return evidence for review."""
import base64
import json
import re
from urllib.parse import urlsplit, quote, urlencode
from .sources import fetch_public, import_url, clean_posting


def public_link(url):
    p = urlsplit(url)
    host = (p.hostname or '').lower()
    if p.scheme not in ('http', 'https') or not host or p.username or p.password:
        raise ValueError('Use a public http(s) profile or project link without credentials.')
    parts = [part for part in p.path.split('/') if part]
    def api(path):
        raw, _, _ = fetch_public('https://api.github.com/' + path)
        return json.loads(raw)
    if host in ('github.com', 'www.github.com'):
        if not parts or len(parts) > 2 or any(not re.fullmatch(r'[\w.-]+', part) for part in parts):
            raise ValueError('Use a GitHub profile or repository URL, e.g. https://github.com/name/project.')
        owner = quote(parts[0], safe='')
        if len(parts) == 1:
            profile = api('users/' + owner)
            repos = api('users/' + owner + '/repos?per_page=30&sort=updated&type=owner')
            text = 'Public GitHub profile metadata; repository ownership does not establish the candidate wrote all code.\n'
            text += json.dumps({k: profile.get(k) for k in ('login', 'name', 'bio', 'blog', 'company', 'public_repos')}, ensure_ascii=False)
            text += '\nUp to 30 recently updated public repositories (not a source-code review):\n'
            text += json.dumps([{k: repo.get(k) for k in ('name', 'description', 'html_url', 'language', 'fork')} for repo in repos], ensure_ascii=False)
            return {'title': 'GitHub profile: ' + parts[0], 'text': text, 'url': url}
        repo_path = owner + '/' + quote(parts[1], safe='')
        repo = api('repos/' + repo_path)
        text = 'Public repository metadata and README. Repository claims and personal authorship need confirmation.\n'
        text += json.dumps({k: repo.get(k) for k in ('full_name', 'description', 'homepage', 'language', 'fork', 'html_url')}, ensure_ascii=False)
        try:
            readme = api('repos/' + repo_path + '/readme')
            if readme.get('encoding') == 'base64':
                decoded = base64.b64decode(readme['content']).decode('utf-8', errors='replace')
                text += '\nREADME excerpt:\n' + decoded[:40000]
        except (ValueError, KeyError):
            text += '\nREADME was unavailable; metadata only.'
        text, _ = clean_posting(text)
        return {'title': 'GitHub project: ' + '/'.join(parts), 'text': text, 'url': url}
    if host in ('youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'):
        try:
            raw, _, _ = fetch_public('https://www.youtube.com/oembed?' + urlencode({'url': url, 'format': 'json'}))
            data = json.loads(raw)
        except (ValueError, OSError) as exc:
            raise ValueError('This YouTube link did not expose readable metadata. Try a specific public video URL, or paste its description, transcript and your contribution into your profile.') from exc
        return {'title': 'YouTube: ' + str(data.get('title') or 'Video')[:180], 'url': url,
                'text': 'YouTube public metadata only. The video has NOT been watched; no transcript or production credits were verified.\n' +
                        json.dumps({k: data.get(k) for k in ('title', 'author_name', 'author_url')}, ensure_ascii=False)}
    result = import_url(url)
    return {'title': result['title'] or 'Public profile page', 'text': result['description'], 'url': result['url']}
