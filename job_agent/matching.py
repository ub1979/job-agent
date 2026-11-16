"""Transparent local evidence matching, not a probability of being hired."""
import math
import re
from collections import Counter
from pydantic import BaseModel, Field

STOP = set('the and for with that this from have your you are was were will our their they who what which been into about also more than only all has can not use using work working experience role skills team job candidate responsibilities requirements university company years ability including strong excellent knowledge relevant such through across within'.split())


def tokens(text):
    text = re.sub(r'artificial intelligence', 'ai', text.lower())
    text = re.sub(r'machine learning', 'ml', text)
    return set(w for w in re.findall(r'[a-z][a-z0-9+#-]*', text) if len(w) > 2 or w in ('ai', 'ml', 'ux', 'ui', 'hr')) - STOP


def rank_jobs(store, jobs):
    profile = store.get('profile', {})
    source_texts = [profile.get('facts', ''), profile.get('linkedin_text', ''), profile.get('self_reported_facts','')]
    for cv in store.cvs():
        if cv['approved']:
            source_texts.append(store.cv(cv['id'])['text'])
    candidate = tokens(' '.join(source_texts))
    preferences = tokens(profile.get('preferences', ''))
    frequencies = Counter(word for job in jobs for word in tokens(job['title'] + ' ' + job.get('description', '')))
    ranked = []
    for job in jobs:
        title = tokens(job['title'])
        description = tokens(job.get('description', ''))
        matched = (title | description) & candidate
        # Rare terms contribute more than boilerplate; title matches count triple.
        score = sum((3 if word in title else 1) * (1 + math.log((len(jobs) + 1) / (frequencies[word] + 1))) for word in matched)
        score += 2 * len(title & preferences)
        highlights = sorted(matched, key=lambda w: (w not in title, frequencies[w], w))[:8]
        ranked.append({**job, 'fit': {'score': round(score, 2) if candidate else None,
                       'matched_terms': highlights, 'basis': 'Local text overlap with approved documents and saved profile; not a qualification check or hiring probability.'}})
    return ranked


class RolePlan(BaseModel):
    roles: list[str] = Field(min_length=1, max_length=4)
    rationale: str = Field(min_length=1, max_length=2000)
