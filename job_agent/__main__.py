import argparse
import uvicorn


def main():
    parser = argparse.ArgumentParser(description='Start Job Agent locally')
    parser.add_argument('--port', type=int, default=9210)
    args = parser.parse_args()
    uvicorn.run('job_agent.server:create_app', factory=True, host='127.0.0.1', port=args.port, access_log=False)


if __name__ == '__main__':
    main()
