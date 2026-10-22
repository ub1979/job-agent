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
    preferences: str = Field(default='', max_length=10000)
    locations: str = Field(default='', max_length=1000)
    work_mode: Literal['any', 'remote', 'hybrid', 'onsite'] = 'any'
    writing_style: str = Field(default='', max_length=4000)


class Settings(BaseModel):
    engine: Literal['hermes', 'claude'] = 'hermes'
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


class AIResponse(BaseModel):
    reply: str = Field(min_length=1, max_length=40000)
    documents: list[DocumentInput] = Field(default_factory=list, max_length=4)
    suggested_status: Status | None = None
