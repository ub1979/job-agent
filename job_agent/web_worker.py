"""Disposable web search process; the parent enforces a wall-clock deadline."""
import json
import sys

from ddgs import DDGS

try:
    request = json.load(sys.stdin)
    hits = DDGS(timeout=8).text(request['query'], max_results=12,
                                backend='google,yahoo,bing,duckduckgo,brave', region='us-en')
    print(json.dumps({'hits': hits}))
except Exception:
    # Do not send provider responses, headers or environment values to the UI.
    print(json.dumps({'error': 'Web search was unavailable or rate-limited. Try again later.'}))
