from scripts import launch


def test_framework_python_identity_is_accepted(monkeypatch):
    identity = 'Thu Oct 22 10:00:00 2026 /opt/homebrew/Frameworks/Python -m job_agent --port 9210'
    monkeypatch.setattr(launch, 'process_identity', lambda pid: identity)
    assert launch.is_our_process({'pid': 123, 'identity': identity})


def test_reused_pid_and_unrelated_process_are_rejected(monkeypatch):
    monkeypatch.setattr(launch, 'process_identity', lambda pid: 'different process')
    assert not launch.is_our_process({'pid': 123, 'identity': 'old identity'})
    assert not launch.is_our_process({'pid': 123, 'identity': 'different process'})
