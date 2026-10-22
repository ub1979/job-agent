"""Disposable browser-test server. Synthetic data and fake AI never enter user storage."""
from pathlib import Path
import tempfile
import uvicorn
from job_agent.server import create_app
from tests.test_workspace import FakeBridge

app = create_app(Path(tempfile.mkdtemp(prefix='job-agent-browser-')), FakeBridge())
if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=9211, access_log=False)
