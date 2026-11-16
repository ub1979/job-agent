"""Explicit OpenAI-compatible endpoints; discovery sends no career documents."""
import ipaddress
import os
from urllib.parse import urlsplit, urlunsplit
import httpx

LOCAL_SERVERS = [('Ollama', 'http://127.0.0.1:11434/v1'), ('LM Studio', 'http://127.0.0.1:1234/v1'), ('Local AI server', 'http://127.0.0.1:8080/v1')]


def normalize_url(value):
    p = urlsplit(value.strip())
    if p.scheme not in ('http', 'https') or not p.hostname or p.username or p.password or p.query or p.fragment:
        raise ValueError('Enter an http(s) AI server address without credentials, query or fragment.')
    try:
        port = p.port
    except ValueError as exc:
        raise ValueError('Invalid server port.') from exc
    if port == 0:
        raise ValueError('Invalid server port.')
    path = p.path.rstrip('/') or '/v1'
    if '..' in path or '%' in path:
        raise ValueError('Use the AI server base path, normally /v1.')
    return urlunsplit((p.scheme, p.netloc.lower(), path, '', ''))


def is_local(value):
    host = urlsplit(value).hostname
    if host == 'localhost':
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def validate_server_settings(settings):
    url = normalize_url(settings.get('base_url', ''))
    if not is_local(url) and not settings.get('remote_approved'):
        raise ValueError('Approve sending AI requests to this server before connecting.')
    if not str(settings.get('model', '')).strip():
        raise ValueError('Choose a model from the AI server first.')
    return url


def request_json(url, payload=None, timeout=3):
    base = url.rsplit('/', 1)[0] if payload is None else url.removesuffix('/chat/completions')
    headers = {'Accept': 'application/json'}
    # A credential is tied to one explicit server, never forwarded to discovered peers.
    configured = os.environ.get('JOB_AGENT_AI_API_BASE', '')
    if configured and normalize_url(configured) == base:
        key = os.environ.get('JOB_AGENT_AI_API_KEY', '')
        if key:
            headers['Authorization'] = 'Bearer ' + key
    with httpx.Client(timeout=timeout, follow_redirects=False, trust_env=False) as client:
        with client.stream('POST' if payload is not None else 'GET', url, json=payload, headers=headers) as response:
            if response.status_code >= 300:
                raise ValueError(f'AI server returned HTTP {response.status_code}. Check its address, authentication and access settings.')
            chunks, size = [], 0
            for chunk in response.iter_bytes():
                size += len(chunk)
                if size > 4 * 1024 * 1024:
                    raise ValueError('AI server response is too large.')
                chunks.append(chunk)
            import json
            return json.loads(b''.join(chunks))


def discover_servers(base_url='', remote_approved=False):
    if base_url:
        base_url = normalize_url(base_url)
        if not is_local(base_url) and not remote_approved:
            raise ValueError('Approve connecting to the displayed server address first.')
        candidates = [('Configured AI server', base_url)]
    else:
        candidates = LOCAL_SERVERS
    found, errors = [], []
    for name, url in candidates:
        try:
            data = request_json(url + '/models')
            models = [item['id'] for item in data.get('data', []) if isinstance(item, dict) and isinstance(item.get('id'), str)][:200]
            if not models:
                errors.append(name + ': no models reported. Load a chat model in the AI server.')
            found.append({'name': name, 'base_url': url, 'models': models})
        except (httpx.HTTPError, ValueError, TypeError, AttributeError):
            if base_url:
                errors.append('Could not list models. Check that the AI server is running, reachable and permits this computer. For authentication set JOB_AGENT_AI_API_BASE and JOB_AGENT_AI_API_KEY locally.')
    return {'servers': found, 'errors': errors}
