from typing import Literal
from datetime import date
from pydantic import BaseModel, Field, field_validator

Status = Literal['saved', 'drafted', 'applied', 'interview', 'offer', 'hired', 'rejected', 'withdrawn', 'no_response']


class JobInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    company: str = Field(default='', max_length=200)
    location: str = Field(default='', max_length=300)
    url: str = Field(default='', max_length=2000)
    description: str = Field(default='', max_length=60000)
    deadline: str = ''
    source: str = Field(default='manual', max_length=100)

    @field_validator('deadline')
    @classmethod
    def valid_date(cls, value):
        if value:
            date.fromisoformat(value)
        return value

    @field_validator('url')
    @classmethod
    def valid_url(cls, value):
        from urllib.parse import urlsplit
        if value and (urlsplit(value).scheme not in ('http', 'https') or not urlsplit(value).hostname):
            raise ValueError('Use an http or https job link')
        return value

    @field_validator('title')
    @classmethod
    def valid_title(cls, value):
        if not value.strip():
            raise ValueError('Add a job title')
        return value.strip()


class StatusInput(BaseModel):
    status: Status
    date: str = Field(default_factory=lambda: date.today().isoformat())

    @field_validator('date')
    @classmethod
    def valid_date(cls, value):
        date.fromisoformat(value)
        return value


class Profile(BaseModel):
    name: str = Field(default='', max_length=200)
    facts: str = Field(default='', max_length=50000)
    self_reported_facts: str = Field(default='', max_length=30000)
    preferences: str = Field(default='', max_length=10000)
    locations: str = Field(default='', max_length=1000)
    work_mode: Literal['any', 'remote', 'hybrid', 'onsite'] = 'any'
    writing_style: str = Field(default='', max_length=4000)
    source_cv_id: str = Field(default='', max_length=32)
    linkedin_url: str = Field(default='', max_length=1000)
    linkedin_text: str = Field(default='', max_length=20000)
    github_url: str = Field(default='', max_length=2000)
    youtube_url: str = Field(default='', max_length=2000)
    other_links: str = Field(default='', max_length=5000)

    @field_validator('github_url', 'youtube_url')
    @classmethod
    def public_profile_url(cls, value):
        from urllib.parse import urlsplit
        value = value.strip()
        if value:
            p = urlsplit(value)
            if p.scheme not in ('https', 'http') or not p.hostname or p.username or p.password:
                raise ValueError('Use a public http(s) profile URL without credentials.')
        return value

    @field_validator('linkedin_url')
    @classmethod
    def linkedin_profile(cls, value):
        from urllib.parse import urlsplit
        value = value.strip()
        if value:
            p = urlsplit(value)
            host = (p.hostname or '').lower()
            if p.scheme != 'https' or not (host == 'linkedin.com' or host.endswith('.linkedin.com')) or not p.path.startswith('/in/') or p.username or p.password:
                raise ValueError('Use your LinkedIn profile URL, starting with https://www.linkedin.com/in/')
        return value


class ResearchInput(BaseModel):
    query: str = Field(min_length=3, max_length=250)
    consent: bool = False


class CVInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=300000)
    kind: Literal['cv', 'academic_cv', 'industry_cv', 'publication', 'book', 'certificate', 'portfolio', 'other', 'online'] = 'cv'
    approved: bool = False


class Settings(BaseModel):
    engine: Literal['hermes', 'claude', 'http'] = 'hermes'
    base_url: str = Field(default='http://127.0.0.1:11434/v1', max_length=1000)
    remote_approved: bool = False
    provider: str = Field(default='', max_length=150)
    model: str = Field(default='', max_length=200)


class MessageInput(BaseModel):
    text: str = Field(min_length=1, max_length=16000)


class DocumentInput(BaseModel):
    kind: Literal['cv', 'cover_letter', 'interview', 'followup', 'notes']
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=40000)


class SearchInput(BaseModel):
    query: str = Field(default='', max_length=300)
    locations: str = Field(default='', max_length=500)
    work_mode: Literal['any', 'remote', 'hybrid', 'onsite'] = 'any'
    days: int = Field(default=30, ge=1, le=90)
    match_mode: Literal['title', 'broad'] = 'title'
    sources: Literal['all', 'freehire', 'web'] = 'all'
    feed_url: str = Field(default='', max_length=2000)


class AIResponse(BaseModel):
    reply: str = Field(min_length=1, max_length=40000)
    documents: list[DocumentInput] = Field(default_factory=list, max_length=4)
    suggested_status: Status | None = None
    user_facts: list[str] = Field(default_factory=list,max_length=5)

    @field_validator('user_facts')
    @classmethod
    def bounded_facts(cls,values):
        if any(not value.strip() or len(value)>2000 for value in values):
            raise ValueError('Use short, exact user statements for profile facts.')
        return [value.strip() for value in values]


class ProfileAction(BaseModel):
    kind: Literal['show_document', 'approve_document', 'approve_finding', 'review_link', 'search_web', 'update_profile', 'replace_fact']
    label: str = Field(min_length=1, max_length=160)
    target: str = Field(default='', max_length=2000)
    field: Literal['', 'name', 'preferences', 'locations', 'work_mode', 'writing_style', 'linkedin_url', 'github_url', 'youtube_url', 'other_links'] = ''
    value: str = Field(default='', max_length=5000)


class ProfileAIResponse(BaseModel):
    reply: str = Field(min_length=1, max_length=40000)
    user_facts: list[str] = Field(default_factory=list, max_length=5)
    actions: list[ProfileAction] = Field(default_factory=list, max_length=8)

    _bounded_facts = field_validator('user_facts')(AIResponse.bounded_facts.__func__)


class DiscoverInput(BaseModel):
    base_url: str = Field(default='', max_length=1000)
    remote_approved: bool = False


class PublicLinkInput(BaseModel):
    url: str = Field(min_length=8, max_length=2000)
    consent: bool = False


class BrowserPageInput(BaseModel):
    url: str = Field(min_length=8,max_length=2000)
