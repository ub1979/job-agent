import subprocess

import pytest

from job_agent.discovery import canonical_url, discover_jobs, web_search, web_tasks, is_job_lead
from job_agent.models import SearchInput


def test_multisource_discovery_filters_deduplicates_and_labels(monkeypatch):
    monkeypatch.setattr('job_agent.discovery.search_jobs', lambda *args: {
        'jobs': [{'title': 'Head of AI', 'url': 'https://example.com/jobs/123?utm_source=freehire', 'source': 'Freehire'}],
        'errors': [], 'filtered_out': 1, 'queries': ['Head of AI'],
    })
    def search(query):
        return [
            {'title': 'Head of AI', 'href': 'https://example.com/jobs/123'},
            {'title': 'Head of Year', 'href': 'https://example.com/jobs/456', 'body': 'AI leadership'},
            {'title': 'Director of Marketing at AI Company', 'href': 'https://example.com/jobs/789'},
            {'title': 'Head of AI at Example | LinkedIn', 'href': 'https://uk.linkedin.com/jobs/view/head-of-ai-123456?trk=search', 'body': 'Hiring a team leader'},
            {'title': 'Head of AI jobs in London', 'href': 'https://uk.linkedin.com/jobs/search?keywords=ai'},
            {'title': 'Head of AI', 'href': 'javascript:alert(1)'},
        ]
    monkeypatch.setattr('job_agent.discovery.web_search', search)
    result = discover_jobs('Head of AI or Director of AI', 'London, Germany', 'remote', 7)
    assert len(result['jobs']) == 2
    lead = result['jobs'][1]
    assert lead['verification'] == 'web_lead'
    assert lead['posted'] is None and lead['work_mode'] == ''
    assert 'not a verified full posting' in lead['description']
    assert 'date filter applies only to Freehire' in result['coverage']
    assert len(result['source_reports']) == 13
    assert not result['errors']


def test_web_failures_are_reported_not_silent_empty_results(monkeypatch):
    def fail(query):
        raise ValueError('Search unavailable')
    monkeypatch.setattr('job_agent.discovery.web_search', fail)
    result = discover_jobs('Head of AI', '', 'any', 30, sources='web')
    assert not result['jobs']
    assert len(result['errors']) == 3
    assert all(s['status'] == 'unavailable' for s in result['source_reports'])


def test_freehire_only_does_not_call_web(monkeypatch):
    monkeypatch.setattr('job_agent.discovery.search_jobs', lambda *args: {
        'jobs': [], 'errors': [], 'filtered_out': 0, 'queries': ['Director of AI'],
    })
    monkeypatch.setattr('job_agent.discovery.web_search', lambda *args: pytest.fail('Unexpected web call'))
    result = discover_jobs('Director of AI', '', 'any', 30, sources='freehire')
    assert len(result['source_reports']) == 1


def test_web_queries_cover_alternatives_and_locations_without_region_lock():
    tasks = web_tasks(['Head of AI', 'Director of AI'], 'London, Germany', 'remote')
    assert len(tasks) == 12
    assert all(('London' in text or 'Germany' in text) and 'remote' in text for _, text in tasks)
    assert all('"London" OR' not in text for _, text in tasks)
    assert all('Head of AI' in text or 'Director of AI' in text for _, text in tasks)
    assert '"Worldwide"' not in web_tasks(['Head of AI'], 'Worldwide', 'any')[0][1]
    assert SearchInput(query='Head of AI').sources == 'all'


def test_tracking_parameters_do_not_duplicate_same_posting():
    assert canonical_url('https://uk.linkedin.com/jobs/view/head-of-ai-1234?trk=foo') == canonical_url('https://www.linkedin.com/jobs/view/1234')
    assert canonical_url('https://example.com/viewjob?jk=abc&utm_source=foo') == 'https://example.com/viewjob?jk=abc'
    assert canonical_url('https://example.com/viewjob?jk=abc') != canonical_url('https://example.com/viewjob?jk=def')


def test_search_worker_timeout_is_actionable(monkeypatch):
    def timeout(*args, **kwargs):
        assert kwargs['timeout'] == 25
        raise subprocess.TimeoutExpired('search', 25)
    monkeypatch.setattr('job_agent.discovery.subprocess.run', timeout)
    with pytest.raises(ValueError, match='timed out'):
        web_search('Head of AI')


@pytest.mark.parametrize('title,url', [
    ('AI director - AI Content Detector', 'https://www.bing.com/aclick?x=1'),
    ('Head Of AI Jobs - Vacancies', 'https://www.reed.co.uk/jobs/head-of-ai-jobs'),
    ('Director of AI software', 'https://example.com/products/director'),
])
def test_web_ads_and_listing_pages_are_not_job_leads(title, url):
    assert not is_job_lead(title, url)


def test_empty_web_search_is_not_reported_as_outage(monkeypatch):
    monkeypatch.setattr('job_agent.discovery.web_search', lambda query: [])
    result = discover_jobs('Head of AI', 'UK, UAE', 'any', 30, sources='web')
    assert not result['errors']
    assert all(r['status'] == 'no_results' for r in result['source_reports'])
    queries = [q for r in result['source_reports'] for q in r['queries']]
    assert any('United Kingdom' in q for q in queries)
    assert any('United Arab Emirates' in q for q in queries)


def test_repeated_irrelevant_web_hits_are_counted_once(monkeypatch):
    monkeypatch.setattr('job_agent.discovery.web_search', lambda query: [
        {'title': 'Head of Year', 'href': 'https://example.com/jobs/123'}])
    result = discover_jobs('Head of AI or Director of AI', 'UK, UAE', 'any', 30, sources='web')
    assert result['filtered_out'] == 1
