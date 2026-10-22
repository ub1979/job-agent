"""Transactional local records. Generated documents are immutable revisions."""
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


def now():
    return datetime.now(timezone.utc).isoformat()


def identity():
    return uuid.uuid4().hex


class Store:
    def __init__(self, root: Path):
        self.root = root
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = root / 'jobs.sqlite3'
        with self.db() as db:
            db.executescript('''
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY, title TEXT NOT NULL, company TEXT NOT NULL,
                    location TEXT NOT NULL, url TEXT NOT NULL, description TEXT NOT NULL,
                    deadline TEXT NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'saved',
                    archived INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL, updated TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY, job_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL,
                    metadata TEXT NOT NULL DEFAULT '{}', created TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), kind TEXT NOT NULL,
                    title TEXT NOT NULL, content TEXT NOT NULL, created TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), label TEXT NOT NULL,
                    data TEXT NOT NULL, created TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS messages_job ON messages(job_id,created);
                CREATE INDEX IF NOT EXISTS documents_job ON documents(job_id,created);
                CREATE TABLE IF NOT EXISTS runs (
                    id TEXT PRIMARY KEY, job_id TEXT NOT NULL, status TEXT NOT NULL,
                    stage TEXT NOT NULL, error TEXT NOT NULL DEFAULT '', created TEXT NOT NULL, updated TEXT NOT NULL);
                CREATE UNIQUE INDEX IF NOT EXISTS one_active_run ON runs(job_id) WHERE status='running';
            ''')
            # A previous process cannot still finish work for this server.
            db.execute("UPDATE runs SET status='interrupted',stage='Interrupted',error='The app restarted. Your message is saved; send it again to continue.' WHERE status='running'")
        os.chmod(self.path, 0o600)

    @contextmanager
    def db(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        try:
            with db:
                yield db
        finally:
            db.close()

    def get(self, key, default=None):
        with self.db() as db:
            row = db.execute('SELECT value FROM kv WHERE key=?', (key,)).fetchone()
            return json.loads(row['value']) if row else default

    def put(self, key, value):
        with self.db() as db:
            db.execute('INSERT OR REPLACE INTO kv VALUES (?,?)', (key, json.dumps(value)))

    def jobs(self):
        with self.db() as db:
            return [dict(r) for r in db.execute('SELECT * FROM jobs ORDER BY updated DESC')]

    def job(self, job_id):
        with self.db() as db:
            row = db.execute('SELECT * FROM jobs WHERE id=?', (job_id,)).fetchone()
            if not row:
                raise KeyError('Job not found')
            return dict(row)

    def create(self, data):
        job_id, stamp = identity(), now()
        with self.db() as db:
            db.execute('INSERT INTO jobs (id,title,company,location,url,description,deadline,source,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?)',
                       (job_id, data['title'], data['company'], data['location'], data['url'], data['description'], data['deadline'], data['source'], stamp, stamp))
        return self.job(job_id)

    def update(self, job_id, data):
        self.job(job_id)
        allowed = {'title', 'company', 'location', 'url', 'description', 'deadline', 'source', 'archived'}
        values = {k: v for k, v in data.items() if k in allowed}
        values['updated'] = now()
        with self.db() as db:
            db.execute('UPDATE jobs SET ' + ','.join(f'{k}=?' for k in values) + ' WHERE id=?', (*values.values(), job_id))
        return self.job(job_id)

    def status(self, job_id, status, occurred):
        self.job(job_id)
        with self.db() as db:
            db.execute('BEGIN IMMEDIATE')
            previous = db.execute('SELECT status FROM jobs WHERE id=?', (job_id,)).fetchone()['status']
            data = {'from': previous, 'to': status, 'date': occurred}
            if status == 'applied':
                docs = db.execute('SELECT id,kind FROM documents WHERE job_id=? ORDER BY created DESC', (job_id,)).fetchall()
                latest = {}
                for doc in docs:
                    if doc['kind'] in ('cv', 'cover_letter'):
                        latest.setdefault(doc['kind'], doc['id'])
                data['document_ids'] = list(latest.values())
                data['posting'] = self.job(job_id)['description']
                data['profile'] = self.get('profile', {})
            db.execute('UPDATE jobs SET status=?,updated=? WHERE id=?', (status, now(), job_id))
            db.execute('INSERT INTO events VALUES (?,?,?,?,?)', (identity(), job_id, status, json.dumps(data), now()))
        return self.job(job_id)

    def messages(self, job_id):
        with self.db() as db:
            rows = db.execute('SELECT * FROM messages WHERE job_id=? ORDER BY created', (job_id,))
            return [{**dict(r), 'metadata': json.loads(r['metadata'])} for r in rows]

    def message(self, job_id, role, content, metadata=None):
        with self.db() as db:
            db.execute('INSERT INTO messages VALUES (?,?,?,?,?,?)', (identity(), job_id, role, content, json.dumps(metadata or {}), now()))

    def documents(self, job_id):
        with self.db() as db:
            return [dict(r) for r in db.execute('SELECT * FROM documents WHERE job_id=? ORDER BY created DESC', (job_id,))]

    def document(self, doc_id):
        with self.db() as db:
            row = db.execute('SELECT * FROM documents WHERE id=?', (doc_id,)).fetchone()
            if not row:
                raise KeyError('Document not found')
            return dict(row)

    def add_document(self, job_id, data):
        self.job(job_id)
        doc_id = identity()
        with self.db() as db:
            db.execute('INSERT INTO documents VALUES (?,?,?,?,?,?)', (doc_id, job_id, data['kind'], data['title'], data['content'], now()))
        return self.document(doc_id)

    def events(self, job_id):
        with self.db() as db:
            rows = db.execute('SELECT * FROM events WHERE job_id=? ORDER BY created DESC', (job_id,))
            return [{**dict(r), 'data': json.loads(r['data'])} for r in rows]

    def start_run(self, job_id, text):
        run_id, stamp = identity(), now()
        with self.db() as db:
            db.execute('INSERT INTO runs VALUES (?,?,?,?,?,?,?)', (run_id, job_id, 'running', 'Reading your request', '', stamp, stamp))
            db.execute('INSERT INTO messages VALUES (?,?,?,?,?,?)', (identity(), job_id, 'user', text, '{}', stamp))
        return run_id

    def run(self, run_id):
        with self.db() as db:
            row = db.execute('SELECT * FROM runs WHERE id=?', (run_id,)).fetchone()
            if not row:
                raise KeyError('Run not found')
            return dict(row)

    def latest_run(self, job_id):
        with self.db() as db:
            row = db.execute('SELECT * FROM runs WHERE job_id=? ORDER BY created DESC LIMIT 1', (job_id,)).fetchone()
            return dict(row) if row else None

    def run_update(self, run_id, stage, status='running', error=''):
        with self.db() as db:
            db.execute('UPDATE runs SET stage=?,status=?,error=?,updated=? WHERE id=? AND status=\'running\'', (stage, status, error, now(), run_id))

    def complete(self, run_id, reply, documents, suggested_status):
        """Commit all outputs together, only if this run has not been cancelled."""
        with self.db() as db:
            db.execute('BEGIN IMMEDIATE')
            run = db.execute('SELECT * FROM runs WHERE id=?', (run_id,)).fetchone()
            if run['status'] != 'running':
                return
            job_id = run['job_id']
            doc_ids = []
            for d in documents if job_id != 'general' else []:
                doc_id = identity()
                doc_ids.append(doc_id)
                db.execute('INSERT INTO documents VALUES (?,?,?,?,?,?)', (doc_id, job_id, d['kind'], d['title'], d['content'], now()))
            metadata = {'document_ids': doc_ids, 'suggested_status': suggested_status}
            db.execute('INSERT INTO messages VALUES (?,?,?,?,?,?)', (identity(), job_id, 'assistant', reply, json.dumps(metadata), now()))
            if any(d['kind'] in ('cv', 'cover_letter') for d in documents):
                db.execute("UPDATE jobs SET status=CASE WHEN status='saved' THEN 'drafted' ELSE status END,updated=? WHERE id=?", (now(), job_id))
            db.execute("UPDATE runs SET status='complete',stage='Done',updated=? WHERE id=?", (now(), run_id))
