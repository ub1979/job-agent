"""Explicit opt-in test of the configured AI, using synthetic career facts only."""
import json
import os
from pathlib import Path
import tempfile
import time

from job_agent.ai import Assistant, Bridge
from job_agent.documents import export_docx, export_pdf
from job_agent.models import JobInput, Profile
from job_agent.store import Store


def main():
    root = Path(tempfile.mkdtemp(prefix='job-agent-live-'))
    print(json.dumps({'test_output': str(root)}), flush=True)
    store = Store(root)
    if os.environ.get('JOB_AGENT_TEST_PROVIDER'):
        store.put('settings', {'engine': 'hermes', 'provider': os.environ['JOB_AGENT_TEST_PROVIDER'], 'model': os.environ['JOB_AGENT_TEST_MODEL']})
    store.put('profile', Profile(name='Alex Example', facts='Alex Example. Email alex@example.com. Product designer at Example Studio from 2022 to 2025. Designed accessible web interfaces and conducted user interviews. BA Design, Example College, 2021. Skills: Figma, accessibility, user research.', writing_style='Concise, clear English.').model_dump())
    job = store.create(JobInput(title='Product designer', company='Sample Company', location='Remote', description='Design accessible web interfaces. Experience with Figma and user interviews required. This is a synthetic posting for software testing.').model_dump())
    class RecordingBridge(Bridge):
        def generate(self, *args, **kwargs):
            text = super().generate(*args, **kwargs)
            # This test only uses the fictional profile above. No real user data.
            (root / f'response-{time.time_ns()}.txt').write_text(text)
            return text
    assistant = Assistant(store, RecordingBridge(root))
    run = assistant.start(job['id'], 'Please draft a short cover letter for this job, using only the verified profile facts.')
    until = time.monotonic() + 300
    while store.run(run)['status'] == 'running' and time.monotonic() < until:
        time.sleep(1)
    result = store.run(run)
    if result['status'] != 'complete':
        assistant.cancel(run)
        raise RuntimeError(result['error'] or 'Live check timed out')
    docs = store.documents(job['id'])
    assert docs and docs[0]['kind'] == 'cover_letter'
    for doc in docs:
        (root / f'{doc["kind"]}.pdf').write_bytes(export_pdf(doc['content']))
        (root / f'{doc["kind"]}.docx').write_bytes(export_docx(doc['content']))
    print(json.dumps({'status': result['status'], 'documents': len(docs), 'pdf_and_word': True, 'test_output': str(root)}))


if __name__ == '__main__':
    main()
