"""Read-only bridge executed by Appling's Python. Never returns credentials.

Keep this process isolated: provider libraries may log or mutate runtime globals.
Only an explicitly framed JSON response crosses back into Job Agent.
"""
import contextlib
import json
import os
from pathlib import Path
import sys


def main():
    payload = json.load(sys.stdin)
    runtime = Path(os.environ['JOB_AGENT_APPLING_ROOT']).resolve()
    sys.path.insert(0, str(runtime))
    with contextlib.redirect_stdout(sys.stderr):
        if payload['command'] == 'catalog':
            from hermes_cli.inventory import build_model_options_payload, load_picker_context
            data = build_model_options_payload(load_picker_context(), explicit_only=False, include_unconfigured=False)
            response = {'providers': [{'id': p['slug'], 'name': p.get('name', p['slug']), 'models': p.get('models', [])}
                                      for p in data.get('providers', []) if p.get('slug') != 'moa'],
                        'provider': data.get('provider', ''), 'model': data.get('model', '')}
        else:
            from hermes_cli.runtime_provider import resolve_runtime_provider
            from hermes_cli.config import load_config
            from run_agent import AIAgent
            cfg = load_config() or {}
            model_cfg = cfg.get('model') or {}
            if not isinstance(model_cfg, dict):
                model_cfg = {'default': str(model_cfg)}
            provider = payload.get('provider') or model_cfg.get('provider', '')
            model = payload.get('model') or model_cfg.get('default', '')
            runtime_config = resolve_runtime_provider(requested=provider or None, target_model=model or None)
            agent = AIAgent(
                model=model, provider=runtime_config.get('provider'), base_url=runtime_config.get('base_url'),
                api_key=runtime_config.get('api_key'), api_mode=runtime_config.get('api_mode'),
                acp_command=runtime_config.get('command'), acp_args=runtime_config.get('args'),
                credential_pool=runtime_config.get('credential_pool'), enabled_toolsets=[],
                skip_context_files=True, skip_memory=True, load_soul_identity=False, session_db=None,
                save_trajectories=False, quiet_mode=True, verbose_logging=False, max_iterations=2,
                max_tokens=7000, reasoning_config={'enabled': True, 'effort': 'medium'},
                ephemeral_system_prompt=payload['system'], platform='job-agent',
            )
            # No arbitrary agent actions: app code owns fetches and data writes.
            agent.tools = []
            agent.valid_tool_names = set()
            agent._skip_mcp_refresh = True
            result = agent.run_conversation(payload['prompt'])
            if result.get('error') or not result.get('final_response'):
                raise RuntimeError('The model did not finish its reply. Check the connection or try another model.')
            response = {'text': result['final_response'], 'model': model, 'provider': provider}
    print('JOB_AGENT_RESULT=' + json.dumps(response))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Provider exceptions sometimes include request headers; never forward them.
        print('JOB_AGENT_RESULT=' + json.dumps({'error': f'AI connection failed ({type(exc).__name__}). Reconnect in Appling or select another model.'}))
        sys.exit(1)
