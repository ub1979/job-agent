"""Short-lived, job-scoped packages for explicit browser form preparation."""
import base64
import hashlib
import secrets
import time
from pydantic import BaseModel, Field
from .documents import export_pdf, export_docx, plain


class BrowserPrepare(BaseModel):
    cv_id: str = Field(min_length=1, max_length=32)
    cover_id: str = Field(default='', max_length=32)
    application_url: str = Field(min_length=8, max_length=2000)
    full_name: str = Field(default='', max_length=200)
    first_name: str = Field(default='', max_length=100)
    last_name: str = Field(default='', max_length=100)
    email: str = Field(default='', max_length=200)
    phone: str = Field(default='', max_length=100)
    linkedin: str = Field(default='', max_length=2000)
    github: str = Field(default='', max_length=2000)
    website: str = Field(default='', max_length=2000)


def site_origin(url):
    from urllib.parse import urlsplit
    p=urlsplit(url)
    if p.scheme not in ('http','https') or not p.hostname or p.username or p.password:
        raise ValueError('Enter the application form’s http(s) URL without credentials.')
    return f'{p.scheme}://{p.netloc.lower()}'


def prepare(store, job_id, data):
    job=store.job(job_id)
    origin=site_origin(data.application_url)
    documents=[]
    for doc_id,kind in [(data.cv_id,'cv'),(data.cover_id,'cover_letter')]:
        if not doc_id:continue
        doc=store.document(doc_id)
        if doc['job_id']!=job_id or doc['kind']!=kind:
            raise ValueError('Choose this job’s CV and cover letter, not documents from another application.')
        variants=[]
        for extension,mime,export in [('docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',export_docx),('pdf','application/pdf',export_pdf)]:
            try:
                raw=export(doc['content'])
            except ValueError:
                continue
            variants.append({'name':kind+'.'+extension,'mime':mime,'base64':base64.b64encode(raw).decode()})
        documents.append({'kind':kind,'title':doc['title'],'text':'\n'.join(plain(line.lstrip('#').strip()) for line in doc['content'].splitlines()),'variants':variants})
    token=secrets.token_urlsafe(32)
    key='browser:'+hashlib.sha256(token.encode()).hexdigest()
    payload={'job_title':job['title'],'company':job['company'],'origin':origin,
             'fields':data.model_dump(exclude={'cv_id','cover_id','application_url'}),
             'documents':documents,'expires_at':time.time()+600}
    store.put(key,payload)
    return {'token':token,'origin':origin,'expires_in':600}


def read_package(store,token):
    if not token or len(token)>100:raise KeyError('Browser code not found')
    key='browser:'+hashlib.sha256(token.encode()).hexdigest()
    package=store.get(key)
    if not package or package['expires_at']<time.time():raise KeyError('Browser code expired. Create another one in Job Agent.')
    return package


class EvidenceCapture(BaseModel):
    text: str = Field(min_length=1, max_length=50000)
    title: str = Field(min_length=1, max_length=200)
    source_url: str = Field(min_length=8, max_length=2000)


def prepare_capture(store,url):
    token=secrets.token_urlsafe(32)
    store.put('browser:'+hashlib.sha256(token.encode()).hexdigest(), {'kind':'evidence_capture','origin':site_origin(url),'expires_at':time.time()+600})
    return {'token':token,'origin':site_origin(url),'expires_in':600}
