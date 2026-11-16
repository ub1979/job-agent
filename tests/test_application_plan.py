import base64
import io
import json

from fastapi.testclient import TestClient
from pypdf import PdfReader

from job_agent.application_plan import build_plan, FillPlan, reviewed_answers
from job_agent.browser_assist import BrowserPrepare, prepare, read_package
from job_agent.models import JobInput
from job_agent.server import create_app
from job_agent.store import Store
from tests.test_workspace import HEADERS, FakeBridge


class PlanBridge(FakeBridge):
    def generate(self, settings, prompt, cancel=None, system=None):
        if 'You map a candidate' not in (system or ''):
            return super().generate(settings, prompt, cancel, system)
        context=json.loads(prompt.split('\n',1)[1])
        self.context=context
        return json.dumps({'answers':[
            {'field_id':'school','value':'Example University','source_id':'profile.facts','source_quote':'PhD at Example University, 2012-2016.','fallback_value':'Other'},
            {'field_id':'legal','value':'No','source_id':'profile.facts','source_quote':'Not legally entitled to work in Canada.'},
            {'field_id':'salary','value':'120000','source_id':'job','source_quote':'Salary 120000'},
            {'field_id':'consent','value':'Yes','source_id':'profile.facts','source_quote':'Not legally entitled to work in Canada.'},
        ]})


def job(store, description='Faculty vacancy. Submit application materials as a single combined PDF file.'):
    return store.create(JobInput(title='AI Faculty',description=description).model_dump())


def documents(store, job_id):
    return [store.add_document(job_id,{'kind':kind,'title':title,'content':'# '+title+'\n\nDEMO ONLY - Fictional applicant. '+text})
        for kind,title,text in [('cv','Academic CV','CandidateCV'),('cover_letter','Cover letter','CandidateLetter'),('notes','Teaching statement','CandidateTeaching')]]


def snapshot():
    return {'snapshot_id':'test-snapshot','url':'https://careers.example.com/form','title':'Application','fields':[
        {'id':'school','label':'School','type':'combobox','required':True,'value':'','options':[],'blocked':False},
        {'id':'legal','label':'Are you legally entitled to work in Canada?','type':'combobox','required':True,'value':'','options':[{'label':'Yes','value':'Yes'},{'label':'No','value':'No'}],'blocked':False},
        {'id':'salary','label':'Expected salary','type':'text','required':True,'value':'','options':[],'blocked':False},
        {'id':'consent','label':'I agree to terms','type':'checkbox','required':True,'value':'','options':[],'blocked':True},
        {'id':'email','label':'Email','type':'text','value':'already@example.com','blocked':False},
    ]}


def test_combined_package_is_ordered_downloadable_and_job_scoped(tmp_path):
    with TestClient(create_app(tmp_path,FakeBridge())) as client:
        store=client.app.state.store
        saved=job(store);cv,cover,statement=documents(store,saved['id'])
        data=BrowserPrepare(cv_id=cv['id'],cover_id=cover['id'],supporting_ids=[statement['id']],full_name='Alex Demo',application_url='https://careers.example.com/form')
        result=prepare(store,saved['id'],data)
        package=result['package']
        assert package['pages']==3
        assert [d['id'] for d in package['documents']]==[cover['id'],cv['id'],statement['id']]
        response=client.get('/api'+package['download_url'])
        assert response.status_code==200
        text='\n'.join(p.extract_text() for p in PdfReader(io.BytesIO(response.content)).pages)
        assert text.index('CandidateLetter')<text.index('CandidateCV')<text.index('CandidateTeaching')
        bundle=read_package(store,result['token'])
        resume=next(d for d in bundle['documents'] if d['kind']=='cv')
        assert resume['variants'][0]['name']=='Alex_Demo_application.pdf'
        assert resume['variants'][0]['mime']=='application/pdf'
        assert base64.b64decode(resume['variants'][0]['base64'])==response.content
        other=job(store)
        assert client.get(f'/api/jobs/{other["id"]}/application-package/{package["id"]}.pdf').status_code==404
        data.package_mode='separate'
        assert prepare(store,saved['id'],data)['package'] is None
        data.supporting_ids=[documents(store,other['id'])[2]['id']]
        try:prepare(store,saved['id'],data)
        except ValueError:pass
        else:raise AssertionError('Cross-job statement was accepted')


def test_plan_rejects_unsupported_answers_and_preserves_blocked_fields(tmp_path):
    store=Store(tmp_path);saved=job(store);bridge=PlanBridge()
    store.put('profile',{'facts':'PhD at Example University, 2012-2016. Not legally entitled to work in Canada.'})
    # Unapproved documents cannot establish an answer.
    store.add_cv('unapproved.txt','Expected salary 120000',b'Expected salary 120000')
    plan=build_plan(store,bridge,saved['id'],snapshot())
    answers={a['field_id']:a for a in plan['answers']}
    assert 'email' not in answers
    assert answers['school']['value']=='Example University'
    assert answers['school']['fallback_value']=='Other'
    assert answers['legal']['value']=='No'
    assert answers['salary']['value']==''
    assert answers['consent']['blocked'] and not answers['consent']['value']
    assert not any('120000' in s['text'] for s in bridge.context['candidate_sources'])
    _,values=reviewed_answers(store,saved['id'],FillPlan(plan_id=plan['id'],url=plan['url'],answers=[{'field_id':'salary','value':'110000'},{'field_id':'consent','value':'Yes'},{'field_id':'unknown','value':'inject'}]))
    assert values==[{'field_id':'salary','value':'110000','fallback_value':''}]
    try:reviewed_answers(store,saved['id'],FillPlan(plan_id=plan['id'],url='https://elsewhere.example/form'))
    except ValueError:pass
    else:raise AssertionError('A changed destination was accepted')


def test_plan_api_uses_fixed_inspection_and_answer_commands(tmp_path,monkeypatch):
    app=create_app(tmp_path,PlanBridge());calls=[]
    with TestClient(app) as client:
        saved=job(app.state.store)
        app.state.store.put('profile',{'facts':'PhD at Example University, 2012-2016. Not legally entitled to work in Canada.'})
        def browser(command,**kwargs):
            calls.append((command,kwargs))
            if command=='inspect':return snapshot()
            return {'results':[{'label':'School','status':'filled'}]}
        monkeypatch.setattr(app.state.browser,'call',browser)
        response=client.post(f'/api/jobs/{saved["id"]}/browser/plan',headers=HEADERS,json={'url':snapshot()['url']})
        assert response.status_code==200,response.text
        plan=response.json()
        response=client.post(f'/api/jobs/{saved["id"]}/browser/answers',headers=HEADERS,json={'plan_id':plan['id'],'url':plan['url'],'answers':[{'field_id':'school','value':'Example University'}]})
        assert response.status_code==200,response.text
        assert [c[0] for c in calls]==['inspect','answers']
        assert calls[-1][1]['snapshot_id']=='test-snapshot'
        assert calls[-1][1]['answers'][0]['fallback_value']=='Other'
        assert not any('submit' in c[0] or 'apply' in c[0] for c in calls)


def test_quote_normalisation_keeps_negation_and_stale_profile_is_rejected(tmp_path):
    from job_agent.application_plan import source_contains
    assert source_contains('PhD 2012-2016. not currently legally entitled to work in Canada.', 'Not currently legally entitled to work in Canada.')
    assert source_contains('PhD 2012-2016.', 'PhD 2012–2016.')
    assert not source_contains('Not currently legally entitled to work in Canada.', 'Currently legally entitled to work in the UK.')
    assert not source_contains('Not currently legally entitled to work in Canada.', 'Currently legally entitled to work in Canada.')
    store=Store(tmp_path);saved=job(store)
    store.put('profile',{'facts':'PhD at Example University, 2012-2016. Not legally entitled to work in Canada.'})
    plan=build_plan(store,PlanBridge(),saved['id'],snapshot())
    store.put('profile',{'facts':'Changed profile facts'})
    try:reviewed_answers(store,saved['id'],FillPlan(plan_id=plan['id'],url=plan['url']))
    except ValueError as exc:assert 'changed' in str(exc)
    else:raise AssertionError('Stale candidate evidence was accepted')
