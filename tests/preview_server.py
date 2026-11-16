"""Disposable browser-test server. Synthetic data and fake AI never enter user storage."""
import os
os.environ['JOB_AGENT_BROWSER_HEADLESS'] = '1'
from fastapi.responses import HTMLResponse
from pathlib import Path
import tempfile
import uvicorn
from job_agent.server import create_app
from tests.test_workspace import FakeBridge

app = create_app(Path(tempfile.mkdtemp(prefix='job-agent-browser-')), FakeBridge())
@app.get('/synthetic-application')
def synthetic_application():
    return HTMLResponse('<form><label>Full name<input name="full_name"></label><label>Email<input name="email"></label><label>Resume<input type="file" name="resume" accept=".pdf"></label><label>Work authorisation<input name="work_authorisation" required></label><button type="submit">Submit application</button></form>')

# Put the synthetic fixture before the production SPA catch-all.
app.router.routes.insert(0, app.router.routes.pop())

if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=9211, access_log=False)
