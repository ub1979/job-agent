import json
from pathlib import Path
import pytest
import httpx
from job_agent.ai_servers import normalize_url, validate_server_settings, discover_servers, request_json
from job_agent.public_profiles import public_link
from job_agent.feeds import feed_jobs
from tests.test_workspace import client, HEADERS


def test_remote_ai_requires_explicit_approval():
    settings={'base_url':'http://192.168.1.50:11434/v1','model':'example-chat'}
    with pytest.raises(ValueError,match='Approve'):
        validate_server_settings(settings)
    assert validate_server_settings({**settings,'remote_approved':True}).startswith('http://192.168.')
    assert validate_server_settings({'base_url':'http://127.0.0.1:1234','model':'test'}) == 'http://127.0.0.1:1234/v1'
    for url in ['file:///tmp/test','http://user:password@example.com/v1','https://example.com/v1?token=secret','http://example.com:0/v1']:
        with pytest.raises(ValueError): normalize_url(url)


def test_ai_discovery_lists_models_without_profile_requests(monkeypatch):
    calls=[]
    def request(url, **kwargs):
        calls.append(url)
        return {'data':[{'id':'chat-model'}]}
    monkeypatch.setattr('job_agent.ai_servers.request_json',request)
    result=discover_servers()
    assert len(result['servers'])==3
    assert all(url.endswith('/v1/models') for url in calls)
    with pytest.raises(ValueError): discover_servers('http://other-pc:1234/v1')
    assert discover_servers('http://other-pc:1234/v1',True)['servers'][0]['models']==['chat-model']


def test_ai_auth_key_is_bound_to_explicit_server(monkeypatch):
    monkeypatch.setenv('JOB_AGENT_AI_API_BASE','http://127.0.0.1:1234/v1')
    monkeypatch.setenv('JOB_AGENT_AI_API_KEY','synthetic-test-key')
    observed=[]
    def handler(req):
        observed.append((str(req.url),req.headers.get('authorization')))
        return httpx.Response(200,json={'data':[]})
    actual=httpx.Client
    monkeypatch.setattr('job_agent.ai_servers.httpx.Client',lambda **kwargs: actual(transport=httpx.MockTransport(handler),**kwargs))
    request_json('http://127.0.0.1:1234/v1/models')
    request_json('http://127.0.0.1:11434/v1/models')
    assert observed[0][1]=='Bearer synthetic-test-key'
    assert observed[1][1] is None


def test_windows_upload_name_is_basename_only(client):
    result=client.post('/api/cvs',headers=HEADERS,files={'file':('C:\\Users\\Test Person\\Documents\\résumé.txt',b'Fictional CV text','text/plain')})
    assert result.status_code==200
    assert result.json()['filename']=='résumé.txt'
    assert 'C:' not in json.dumps(client.get('/api/cvs').json())


def test_public_github_repo_reads_readme_and_retains_scope(monkeypatch):
    import base64
    def fetch(url):
        body={'full_name':'example/studio','description':'Video studio','fork':False} if not url.endswith('/readme') else {'encoding':'base64','content':base64.b64encode(b'# Studio\nCreates storyboard videos.').decode()}
        return json.dumps(body).encode(),'application/json',url
    monkeypatch.setattr('job_agent.public_profiles.fetch_public',fetch)
    result=public_link('https://github.com/example/studio')
    assert 'Creates storyboard videos.' in result['text']
    assert 'personal authorship need confirmation' in result['text']


def test_youtube_metadata_does_not_claim_watching(monkeypatch):
    monkeypatch.setattr('job_agent.public_profiles.fetch_public',lambda url:(json.dumps({'title':'Example film','author_name':'Example channel'}).encode(),'application/json',url))
    result=public_link('https://www.youtube.com/watch?v=example123')
    assert 'NOT been watched' in result['text']
    assert 'no transcript' in result['text']


def test_link_reading_requires_consent_then_approval(client,monkeypatch):
    monkeypatch.setattr('job_agent.public_profiles.public_link',lambda url:{'url':url,'title':'Public project','text':'Readable project evidence.'})
    assert client.post('/api/profile/review-link',headers=HEADERS,json={'url':'https://github.com/example/project'}).status_code==400
    found=client.post('/api/profile/review-link',headers=HEADERS,json={'url':'https://github.com/example/project','consent':True}).json()['candidates'][0]
    assert not client.get('/api/cvs').json()
    approved=client.post('/api/profile/research/'+found['id']+'/approve',headers=HEADERS,json={'title':found['title'],'text':found['text'],'approved':True})
    assert approved.status_code==200
    assert approved.json()['source_url']==found['url']


def test_rss_and_atom_filter_and_keep_original_links(monkeypatch):
    rss=b'<rss><channel><item><title>Head of AI</title><link>https://example.com/jobs/1</link><description>Lead AI teams</description></item><item><title>Head of Year</title><link>https://example.com/jobs/2</link></item></channel></rss>'
    monkeypatch.setattr('job_agent.feeds.fetch_public',lambda url:(rss,'application/rss+xml',url))
    result=feed_jobs('https://example.com/jobs.rss','Head of AI')
    assert len(result['jobs'])==1 and result['filtered_out']==1
    assert result['jobs'][0]['url']=='https://example.com/jobs/1'
    atom=b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Director of AI</title><link href="https://example.com/jobs/3"/><summary>Lead</summary></entry></feed>'
    monkeypatch.setattr('job_agent.feeds.fetch_public',lambda url:(atom,'application/atom+xml',url))
    assert feed_jobs('https://example.com/jobs.atom','Director of AI')['jobs'][0]['url'].endswith('/3')


def test_feed_rejects_xml_entities(monkeypatch):
    content=b'<!DOCTYPE rss [<!ENTITY secret SYSTEM "file:///etc/passwd">]><rss><channel><item><title>&secret;</title></item></channel></rss>'
    monkeypatch.setattr('job_agent.feeds.fetch_public',lambda url:(content,'application/xml',url))
    with pytest.raises(ValueError,match='RSS or Atom'): feed_jobs('https://example.com/jobs.rss','AI')


def test_standalone_ai_server_worker_roundtrip(tmp_path):
    from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
    import threading
    from job_agent.ai import Bridge
    received=[]
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            received.append((self.path,json.loads(self.rfile.read(int(self.headers['Content-Length'])))))
            body=json.dumps({'choices':[{'message':{'content':'Synthetic connection ready.'}}]}).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
        def log_message(self,*args):pass
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try:
        answer=Bridge(tmp_path).generate({'engine':'http','base_url':f'http://127.0.0.1:{server.server_port}/v1','model':'synthetic-model'},'Synthetic prompt',system='Synthetic system')
        assert answer=='Synthetic connection ready.'
        assert received[0][0]=='/v1/chat/completions'
        assert received[0][1]['messages']==[{'role':'system','content':'Synthetic system'},{'role':'user','content':'Synthetic prompt'}]
    finally:
        server.shutdown();server.server_close();thread.join()


def test_linkedin_failure_explains_browser_import(monkeypatch):
    def blocked(url):raise ValueError('Blocked')
    monkeypatch.setattr('job_agent.public_profiles.import_url',blocked)
    with pytest.raises(ValueError,match='browser text-import code'):
        public_link('https://www.linkedin.com/in/example')
