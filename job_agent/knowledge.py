"""Job-relevant source excerpts with attribution and explicit context limits."""
import re


def evidence(store, job=None, question='', budget=65000):
    query = ' '.join([str((job or {}).get('title', '')), str((job or {}).get('description', '')), question]).lower()
    terms = set(re.findall(r'\w{3,}', query))
    academic = bool(re.search(r'\b(university|lecturer|professor|academic|faculty|postdoc|teaching)\b', query))
    chunks, summaries = [], []
    for item in store.cvs():
        if not item['approved']:
            continue
        doc = store.cv(item['id'])
        summaries.append({k: doc[k] for k in ('id', 'title', 'kind', 'source_url')})
        for offset in range(0, len(doc['text']), 2200):
            text = doc['text'][offset:offset + 2200]
            words = set(re.findall(r'\w{3,}', text.lower()))
            score = len(terms & words)
            if academic and doc['kind'] in ('academic_cv', 'publication', 'book'):
                score += 12
            if not academic and doc['kind'] == 'industry_cv':
                score += 5
            chunks.append((score, offset, doc, text))
    # Give every approved source a first excerpt before filling with relevant passages.
    ranked = sorted(chunks, key=lambda c: (c[1] != 0, -c[0], c[1]))
    excerpts, used = [], 0
    for _, offset, doc, text in ranked:
        if used + len(text) > budget:
            continue
        excerpts.append({'source_id': doc['id'], 'title': doc['title'], 'kind': doc['kind'],
                         'source_url': doc['source_url'], 'character_offset': offset, 'text': text})
        used += len(text)
    return {'sources': summaries, 'excerpts': excerpts, 'scope': 'Only user-approved sources. Excerpts selected for this job; not all full documents fit.',
            'truncated': len(excerpts) < len(chunks)}
