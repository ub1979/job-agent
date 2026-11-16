"""Small local launcher; never kills an unrelated service on the chosen port."""
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser

# Script execution from a folder whose name contains spaces is supported.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from job_agent.platforms import venv_python, spawn_options, stop_tree
import psutil

ROOT = Path(__file__).resolve().parent.parent
RUN = ROOT / '.run'
PID = RUN / 'server.json'


IS_WINDOWS = os.name == 'nt'

def probe(port):
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/health', timeout=1) as response:
            return json.load(response).get('app') == 'job-agent'
    except Exception:
        return False


def process_identity(pid):
    if IS_WINDOWS:
        try:
            process = psutil.Process(pid)
            return json.dumps([process.create_time(), process.cmdline()])
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return ''
    result = subprocess.run(['ps', '-p', str(pid), '-o', 'lstart=', '-o', 'command='],
                            capture_output=True, text=True, env={**os.environ, 'LC_ALL': 'C'})
    return result.stdout.strip() if result.returncode == 0 else ''


def is_our_process(data):
    current = process_identity(data['pid'])
    return bool(current and current == data.get('identity') and ('-m job_agent' in current or '"-m", "job_agent"' in current))


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else 'start'
    if action == 'stop':
        if not PID.exists():
            print('No Job Agent process was recorded. Nothing to stop.')
            return
        data = json.loads(PID.read_text())
        if is_our_process(data):
            if IS_WINDOWS:
                stop_tree(psutil.Process(data['pid']))
            else:
                os.kill(data['pid'], signal.SIGTERM)
            for _ in range(80):
                if not is_our_process(data):
                    break
                time.sleep(.1)
            if is_our_process(data):
                raise SystemExit('Job Agent is still shutting down. Wait a moment and run ./stop.sh again.')
            print('Job Agent stopped. Your records are saved.')
        else:
            print('The recorded Job Agent process is no longer running.')
        PID.unlink(missing_ok=True)
        return
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 9210
    if not 1024 <= port <= 65535:
        raise SystemExit('Choose a port between 1024 and 65535.')
    if PID.exists():
        recorded = json.loads(PID.read_text())
        if is_our_process(recorded) and probe(recorded['port']):
            url = f'http://127.0.0.1:{recorded["port"]}'
            print(f'Job Agent is already running: {url}')
            webbrowser.open(url)
            return
    with socket.socket() as sock:
        if sock.connect_ex(('127.0.0.1', port)) == 0:
            raise SystemExit(f'Port {port} is already in use. Choose another port: ./start.sh 9212')
    RUN.mkdir(mode=0o700, exist_ok=True)
    with (RUN / 'server.log').open('ab') as log:
        process = subprocess.Popen([str(venv_python(ROOT)), '-m', 'job_agent', '--port', str(port)],
                                   stdin=subprocess.DEVNULL, stdout=log, stderr=log, cwd=ROOT, **spawn_options())
    PID.write_text(json.dumps({'pid': process.pid, 'port': port, 'identity': process_identity(process.pid)}))
    for _ in range(80):
        if probe(port):
            # On macOS Python may resolve through a framework executable during
            # startup. Store its final identity, not the invoked symlink path.
            PID.write_text(json.dumps({'pid': process.pid, 'port': port, 'identity': process_identity(process.pid)}))
            url = f'http://127.0.0.1:{port}'
            print(f'Job Agent is ready: {url}\nStop it with ./stop.sh')
            if os.environ.get('JOB_AGENT_NO_BROWSER') != '1':
                webbrowser.open(url)
            return
        if process.poll() is not None:
            raise SystemExit('Job Agent could not start. See .run/server.log for details.')
        time.sleep(.25)
    raise SystemExit('Job Agent is still starting. Check .run/server.log.')


if __name__ == '__main__':
    main()
