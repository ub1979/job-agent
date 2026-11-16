import json
import time

from fastapi.testclient import TestClient

from job_agent.models import ProfileAIResponse
from job_agent.server import create_app
from tests.test_workspace import HEADERS, FakeBridge


def finished(client):
    for _ in range(150):
        data = client.get('/api/profile/chat').json()
        if data['run'] and data['run']['status'] != 'running':
            assert data['run']['status'] == 'complete', data['run']
            return data
        time.sleep(.02)
    raise AssertionError('Profile chat did not finish')


class ProfileBridge(FakeBridge):
    def __init__(self, response):
        self.response = response
        self.contexts = []

    def generate(self, settings, prompt, cancel=None, system=None):
        self.contexts.append(json.loads(prompt.split('\n', 1)[1]))
        return json.dumps(self.response)


def upload(client, text='Alex Example led AI teams.'):
    return client.post('/api/cvs', files={'file': ('academic.txt', text.encode(), 'text/plain')}, headers=HEADERS).json()


def test_profile_chat_trusts_hobbies_and_persists_history(tmp_path):
    statement = 'I am a good singer and I directed five documentaries.'
    bridge = ProfileBridge({'reply': 'Which years did you work on the documentaries?', 'user_facts': [statement, 'Invented award'], 'actions': []})
    with TestClient(create_app(tmp_path, bridge)) as client:
        response = client.post('/api/profile/chat/messages', json={'text': statement}, headers=HEADERS)
        assert response.status_code == 200
        state = finished(client)
        assert statement in state['profile']['self_reported_facts']
        assert 'Invented' not in state['profile']['self_reported_facts']
        assert state['messages'][-1]['metadata']['saved_user_facts'] == [statement]
        assert not client.get('/api/jobs/general').json()['messages']
        assert not client.get('/api/jobs').json()
        assert client.get('/api/profile/readiness').json()['ready']
    with TestClient(create_app(tmp_path, bridge)) as client:
        assert len(client.get('/api/profile/chat').json()['messages']) == 2


def test_chat_approvals_show_text_wait_for_click_and_reject_stale_sources(tmp_path):
    bridge = ProfileBridge({'reply': 'Review this document before approving.', 'actions': []})
    with TestClient(create_app(tmp_path, bridge)) as client:
        doc = upload(client)
        bridge.response['actions'] = [{'kind': 'approve_document', 'label': 'Review academic CV', 'target': doc['id']}]
        client.post('/api/profile/chat/messages', json={'text': 'Approve my academic CV'}, headers=HEADERS)
        state = finished(client)
        action = state['messages'][-1]['metadata']['profile_actions'][0]
        assert not client.get('/api/cvs/' + doc['id']).json()['approved']
        detail = client.get('/api/profile/chat/actions/' + action['id']).json()
        assert detail['record']['text'] == doc['text']
        assert not bridge.contexts[-1]['documents_for_review'][0]['approved']
        approved = client.post('/api/profile/chat/actions/' + action['id'], headers=HEADERS)
        assert approved.status_code == 200, approved.text
        assert client.get('/api/cvs/' + doc['id']).json()['approved']
        assert client.post('/api/profile/chat/actions/' + action['id'], headers=HEADERS).status_code == 200
        review = client.post('/api/profile/chat/documents/' + doc['id'] + '/review', headers=HEADERS).json()
        client.put('/api/cvs/' + doc['id'], headers=HEADERS, json={'title': doc['title'], 'text': 'Changed facts', 'approved': False})
        stale = client.post('/api/profile/chat/actions/' + review['id'], headers=HEADERS)
        assert stale.status_code == 400
        assert 'changed' in stale.json()['detail']
        assert not client.get('/api/cvs/' + doc['id']).json()['approved']


def test_chat_internet_is_explicit_and_findings_need_separate_approval(tmp_path, monkeypatch):
    calls = []
    def search(query):
        calls.append(query)
        return [{'href': 'https://example.com/alex', 'title': 'Alex Example portfolio', 'body': 'Possible public production credits.'}]
    monkeypatch.setattr('job_agent.server.web_search', search)
    bridge = ProfileBridge({'reply': 'You can run this search.', 'actions': [{'kind': 'search_web', 'target': 'Alex Example documentaries', 'label': 'Search public credits'}]})
    with TestClient(create_app(tmp_path, bridge)) as client:
        client.post('/api/profile/chat/messages', json={'text': 'Search online for my documentaries'}, headers=HEADERS)
        state = finished(client)
        assert calls == []
        action = state['messages'][-1]['metadata']['profile_actions'][0]
        result = client.post('/api/profile/chat/actions/' + action['id'], headers=HEADERS)
        assert result.status_code == 200
        assert calls == ['Alex Example documentaries']
        assert client.get('/api/cvs').json() == []
        pending = client.get('/api/profile/chat').json()['findings']
        assert len(pending) == 1
        review = client.post('/api/profile/chat/findings/' + pending[0]['id'] + '/review', headers=HEADERS).json()
        assert client.post('/api/profile/chat/actions/' + review['id'], headers=HEADERS).status_code == 200
        assert client.get('/api/cvs').json()[0]['approved']
        assert client.get('/api/profile/chat').json()['findings'] == []
        client.post('/api/profile/chat/actions/' + action['id'], headers=HEADERS)
        assert len(calls) == 1


def test_profile_updates_require_literal_values_and_preserve_concurrent_facts(tmp_path):
    bridge = ProfileBridge({'reply': 'Review your link.', 'actions': [
        {'kind': 'update_profile', 'label': 'Save GitHub', 'field': 'github_url', 'value': 'https://github.com/example'},
        {'kind': 'update_profile', 'label': 'Invented name', 'field': 'name', 'value': 'Invented'},
        {'kind': 'approve_document', 'label': 'Missing document', 'target': 'does-not-exist'},
    ]})
    with TestClient(create_app(tmp_path, bridge)) as client:
        client.post('/api/profile/chat/messages', json={'text': 'My GitHub is https://github.com/example'}, headers=HEADERS)
        state = finished(client)
        actions = state['messages'][-1]['metadata']['profile_actions']
        assert len(actions) == 1
        assert not state['profile'].get('github_url')
        client.put('/api/profile', headers=HEADERS, json={'self_reported_facts': '- I sing.'})
        assert client.post('/api/profile/chat/actions/' + actions[0]['id'], headers=HEADERS).status_code == 200
        profile = client.get('/api/bootstrap').json()['profile']
        assert profile['github_url'] == 'https://github.com/example'
        assert profile['self_reported_facts'] == '- I sing.'


def test_cancelled_profile_run_cannot_save_actions_or_claims(tmp_path):
    app = create_app(tmp_path, FakeBridge())
    store = app.state.store
    run_id = store.start_run('__profile__', 'I sing.')
    store.run_update(run_id, 'Stopped', 'cancelled')
    store.complete(run_id, 'Hello', [], None, ['I sing.'], [{'id': 'unsafe'}])
    assert store.get('profile', {}) == {}
    assert not store.get('profile-action:unsafe')
    assert len(store.messages('__profile__')) == 1
    assert ProfileAIResponse(reply='Hello', user_facts=[' I sing. ']).user_facts == ['I sing.']


def test_profile_fact_corrections_and_removal_are_reviewable(tmp_path):
    bridge = ProfileBridge({'reply': 'Review this correction.', 'actions': [{'kind': 'replace_fact', 'label': 'Correct singing experience', 'target': 'I sing.', 'value': 'I sing professionally.'}]})
    with TestClient(create_app(tmp_path, bridge)) as client:
        client.put('/api/profile', headers=HEADERS, json={'self_reported_facts': '- I sing.\n- I lead AI teams.'})
        client.post('/api/profile/chat/messages', json={'text': 'Correct that to I sing professionally.'}, headers=HEADERS)
        state = finished(client)
        action = state['messages'][-1]['metadata']['profile_actions'][0]
        assert state['profile']['self_reported_facts'] == '- I sing.\n- I lead AI teams.'
        assert client.post('/api/profile/chat/actions/' + action['id'], headers=HEADERS).status_code == 200
        assert client.get('/api/bootstrap').json()['profile']['self_reported_facts'] == '- I sing professionally.\n- I lead AI teams.'
        bridge.response['actions'][0].update(target='I sing professionally.', value='')
        client.post('/api/profile/chat/messages', json={'text': 'Remove my singing fact'}, headers=HEADERS)
        action = finished(client)['messages'][-1]['metadata']['profile_actions'][0]
        assert client.post('/api/profile/chat/actions/' + action['id'], headers=HEADERS).status_code == 200
        assert client.get('/api/bootstrap').json()['profile']['self_reported_facts'] == '- I lead AI teams.'
