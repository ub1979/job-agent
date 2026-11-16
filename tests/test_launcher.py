import pytest
from scripts import launch


def test_framework_python_identity_is_accepted(monkeypatch):
    identity = 'Thu Oct 22 10:00:00 2026 /opt/homebrew/Frameworks/Python -m job_agent --port 9210'
    monkeypatch.setattr(launch, 'process_identity', lambda pid: identity)
    assert launch.is_our_process({'pid': 123, 'identity': identity})


def test_reused_pid_and_unrelated_process_are_rejected(monkeypatch):
    monkeypatch.setattr(launch, 'process_identity', lambda pid: 'different process')
    assert not launch.is_our_process({'pid': 123, 'identity': 'old identity'})
    assert not launch.is_our_process({'pid': 123, 'identity': 'different process'})


@pytest.mark.skipif(launch.IS_WINDOWS, reason="Unix ps locale test")
def test_process_identity_is_independent_of_shell_locale(monkeypatch):
    from types import SimpleNamespace
    def run(args, **kwargs):
        assert kwargs['env']['LC_ALL'] == 'C'
        return SimpleNamespace(stdout='stable identity\n', returncode=0)
    monkeypatch.setattr(launch.subprocess, 'run', run)
    assert launch.process_identity(123) == 'stable identity'


def test_windows_identity_tracks_creation_time_and_command(monkeypatch):
    from types import SimpleNamespace
    monkeypatch.setattr(launch, 'IS_WINDOWS', True)
    monkeypatch.setattr(launch.psutil, 'Process', lambda pid: SimpleNamespace(create_time=lambda: 123.45, cmdline=lambda: ['C:\\App Folder\\python.exe', '-m', 'job_agent', '--port', '9210']))
    identity = launch.process_identity(42)
    assert launch.is_our_process({'pid':42,'identity':identity})
    assert not launch.is_our_process({'pid':42,'identity':'old process'})


def test_windows_venv_path(monkeypatch, tmp_path):
    from job_agent import platforms
    monkeypatch.setattr(platforms, 'IS_WINDOWS', True)
    assert str(platforms.venv_python(tmp_path)).replace('\\', '/').endswith('.venv/Scripts/python.exe')
