"""Search relevance regressions using deliberately noisy source results."""
import json
from urllib.parse import parse_qs, urlsplit

import pytest

from job_agent.sources import search_jobs


TITLES = [
    'Manager - Financial Controlling',
    'Head of Year EYFS - Yasmina British Academy (AY 27/28)',
    'Senior Operations Manager', 'Head of Influencer Marketing', 'Head of TikTok Shop',
    'Head of AI', 'Global Head of Artificial Intelligence',
    'Senior Director, AI & Machine Learning', 'Director of AI Strategy',
    'AI Engineer', 'Head of Retail', 'Director of Marketing',
    'Director of Infrastructure Engineering — Micro1 via AI Gig Scout',
]


def noisy_source(monkeypatch, ignored=False):
    calls = []
    def fetch(url):
        calls.append(parse_qs(urlsplit(url).query))
        payload = {'data': [
            {'title': title, 'url': f'https://example.com/{i}',
             'description': 'Reports to the Director of AI. Uses artificial intelligence.'}
            for i, title in enumerate(TITLES)
        ], 'meta': {'ignored_params': ['q'] if ignored else []}}
        return json.dumps(payload).encode(), 'application/json', url
    monkeypatch.setattr('job_agent.sources.fetch_public', fetch)
    return calls


def test_ai_leadership_requires_domain_and_seniority_in_title(monkeypatch):
    calls = noisy_source(monkeypatch)
    result = search_jobs('I want Head of AI or Director of AI', '', 'any', 30)
    assert [job['title'] for job in result['jobs']] == TITLES[5:9]
    assert result['filtered_out'] == 9
    assert {call['q'][0] for call in calls} == {'Head of AI', 'Director of AI'}
    assert not result['errors']


def test_broad_search_is_explicit_opt_in(monkeypatch):
    noisy_source(monkeypatch)
    assert len(search_jobs('Head of AI', '', 'any', 30, 'broad')['jobs']) == len(TITLES)


def test_other_job_families_are_also_title_filtered(monkeypatch):
    noisy_source(monkeypatch)
    assert [j['title'] for j in search_jobs('Operations Manager', '', 'any', 30)['jobs']] == ['Senior Operations Manager']
    assert search_jobs('Head of Quantum Computing', '', 'any', 30)['jobs'] == []


def test_ignored_source_filters_fail_closed(monkeypatch):
    noisy_source(monkeypatch, ignored=True)
    result = search_jobs('Head of AI', '', 'any', 30)
    assert not result['jobs']
    assert 'did not apply' in result['errors'][0]


@pytest.mark.parametrize('query', ['', '  ', 'or', 'the', 'one;two;three;four;five'])
def test_invalid_or_unbounded_queries_are_rejected(query):
    with pytest.raises(ValueError):
        search_jobs(query, '', 'any', 30)
