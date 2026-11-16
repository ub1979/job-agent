"""Executable paths and process ownership across Windows, macOS and Linux."""
import os
from pathlib import Path
import signal
import subprocess
import psutil


IS_WINDOWS = os.name == 'nt'

def venv_python(root):
    return Path(root) / ('.venv/Scripts/python.exe' if IS_WINDOWS else '.venv/bin/python')


def spawn_options():
    if IS_WINDOWS:
        return {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS}
    return {'start_new_session': True}


def stop_tree(process):
    if not IS_WINDOWS:
        os.killpg(process.pid, signal.SIGTERM)
        return
    try:
        parent = psutil.Process(process.pid)
        children = parent.children(recursive=True)
        for child in reversed(children):
            try:
                child.terminate()
            except psutil.NoSuchProcess:
                pass
        parent.terminate()
        _, alive = psutil.wait_procs(children + [parent], timeout=3)
        for item in alive:
            try:
                item.kill()
            except psutil.NoSuchProcess:
                pass
    except psutil.NoSuchProcess:
        pass
