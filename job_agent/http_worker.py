"""Cancellable isolated completion against the user's explicitly selected AI server."""
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from job_agent.ai_servers import request_json, validate_server_settings

try:
    request = json.load(sys.stdin)
    base = validate_server_settings(request)
    body = {'model': request['model'], 'messages': [
        {'role': 'system', 'content': request['system']},
        {'role': 'user', 'content': request['prompt']}], 'stream': False, 'max_tokens': 7000}
    result = request_json(base + '/chat/completions', body, timeout=210)
    text = result['choices'][0]['message']['content']
    if not isinstance(text, str) or not text.strip():
        raise ValueError('No text')
    print(json.dumps({'text': text}))
except Exception:
    print(json.dumps({'error': 'The selected AI server could not finish a text response. Check the server, chat model and access settings, then retry.'}))
