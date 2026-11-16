"""Disposable browser-test server. Synthetic data and fake AI never enter user storage."""
import os
import json
os.environ['JOB_AGENT_BROWSER_HEADLESS'] = '1'
from fastapi.responses import HTMLResponse
from pathlib import Path
import tempfile
import uvicorn
from job_agent.server import create_app
from tests.test_workspace import FakeBridge

class ProfilePreviewBridge(FakeBridge):
    def generate(self, settings, prompt, cancel=None, system=None):
        if system and "You are Job Agent's profile assistant" in system:
            context = json.loads(prompt.split('\n', 1)[1])
            latest = context['conversation'][-1]['content']
            actions = []
            facts = ['I am a good singer.'] if latest == 'I am a good singer.' else []
            if 'Approve' in latest and context['documents_for_review']:
                doc = context['documents_for_review'][0]
                actions = [{'kind': 'approve_document', 'label': 'Review uploaded CV', 'target': doc['id']}]
            if 'online' in latest:
                actions = [{'kind': 'search_web', 'label': 'Find public credits', 'target': 'Alex Example documentaries'}]
            if 'profile' in latest.lower():
                reply = 'Your profile includes your saved career facts and interests. Singing is included only where relevant.'
            else:
                reply = 'Tell me a little more about when you started.'
            return json.dumps({'reply': reply, 'user_facts': facts, 'actions': actions})
        return super().generate(settings, prompt, cancel, system)

app = create_app(Path(tempfile.mkdtemp(prefix='job-agent-browser-')), ProfilePreviewBridge())
@app.get('/synthetic-application')
def synthetic_application():
    return HTMLResponse('<form><label>Full name<input name="full_name"></label><label>Email<input name="email"></label><label>Resume<input type="file" name="resume" accept=".pdf"></label><label>Work authorisation<input name="work_authorisation" required></label><button type="submit">Submit application</button></form>')

# Put the synthetic fixture before the production SPA catch-all.
app.router.routes.insert(0, app.router.routes.pop())

if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=9211, access_log=False)
