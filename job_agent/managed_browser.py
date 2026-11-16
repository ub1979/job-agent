"""Private app-owned Chrome/Edge profile; no extension or pairing codes."""
import json
import os
from pathlib import Path
import queue
import shutil
import subprocess
import threading
from .platforms import spawn_options, stop_tree
from .browser_assist import site_origin

ROOT=Path(__file__).resolve().parent.parent


class ManagedBrowser:
    def __init__(self,root):
        self.root=Path(root)/'application-browser'
        self.root.mkdir(exist_ok=True,parents=True,mode=0o700)
        self.lock=threading.Lock()
        self.process=None
        self.output=queue.Queue()
        self.packages={}

    def _start(self):
        if self.process and self.process.poll() is None:return
        node=shutil.which('node')
        if not node:raise RuntimeError('Node.js is required to open the application browser.')
        self.output=queue.Queue()
        self.process=subprocess.Popen([node,str(ROOT/'browser/managed.mjs'),str(self.root)],cwd=ROOT,env={k:v for k,v in os.environ.items() if not any(secret in k.upper() for secret in ('API_KEY','AUTH_TOKEN','PASSWORD','SECRET','ACCESS_TOKEN'))},stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,encoding="utf-8",bufsize=1,**spawn_options())
        output=self.output
        process=self.process
        def read():
            try:
                for line in process.stdout:output.put(line)
            finally:output.put(None)
        threading.Thread(target=read,daemon=True).start()

    def call(self,command,**data):
        with self.lock:
            self._start()
            try:
                self.process.stdin.write(json.dumps({'command':command,**data})+'\n');self.process.stdin.flush()
                line=self.output.get(timeout=120)
                if line is None:raise RuntimeError('Application browser closed. Open it again.')
                result=json.loads(line)
                if result.get('error'):raise RuntimeError(result['error'])
                return result['result']
            except (queue.Empty,BrokenPipeError,json.JSONDecodeError) as exc:
                if self.process and self.process.poll() is None:stop_tree(self.process)
                raise RuntimeError('The browser took too long or stopped. Open it again and retry.') from exc

    def open(self,key,url,bundle=None):
        site_origin(url)
        if bundle:self.packages[key]=bundle
        return self.call('open',key=key,url=url,bundle=bundle)

    def fill(self,key,url):
        site_origin(url)
        if key not in self.packages:raise ValueError('Prepare this job’s documents first.')
        return self.call('fill',key=key,approved_url=url,bundle=self.packages[key])

    def close(self):
        if not self.process or self.process.poll() is not None:return
        try:self.call('close')
        except RuntimeError:pass
        try:self.process.wait(timeout=10)
        except subprocess.TimeoutExpired:stop_tree(self.process)
        self.packages.clear()
