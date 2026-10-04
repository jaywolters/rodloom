"""Deploy with AWS CLI credentials (no SDK or stored GitHub tokens).
Run: python scripts/deploy.py --execute --confirm-account 355609608739
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REGION = 'us-west-2'


def aws(service, operation, payload=None, extra=()):
    command = ['aws', service, operation, '--region', REGION, '--output', 'json']
    with tempfile.TemporaryDirectory() as temp:
        if payload:
            path = Path(temp) / 'input.json'
            path.write_text(json.dumps(payload), encoding='utf-8')
            command += ['--cli-input-json', 'file://' + str(path)]
        result = subprocess.run(command + list(extra), capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return json.loads(result.stdout) if result.stdout.strip() else {}


def deploy_frontend(app):
    """Publish the static build without modifying the legacy backend or app settings."""
    app_id = app['appId']
    subprocess.run(['node', 'scripts/build.mjs'], cwd=ROOT, check=True)
    with tempfile.TemporaryDirectory() as temp:
        frontend = Path(temp) / 'frontend.zip'
        with zipfile.ZipFile(frontend, 'w', zipfile.ZIP_DEFLATED) as z:
            for file in (ROOT / 'dist').rglob('*'):
                if file.is_file():
                    z.write(file, file.relative_to(ROOT / 'dist').as_posix())
        deployment = aws('amplify', 'create-deployment', {'appId': app_id, 'branchName': 'main'})
        request = urllib.request.Request(deployment['zipUploadUrl'], data=frontend.read_bytes(), method='PUT')
        with urllib.request.urlopen(request, timeout=60) as response:
            response.read()
        aws('amplify', 'start-deployment', {'appId': app_id, 'branchName': 'main', 'jobId': deployment['jobId']})
        for _ in range(60):
            job = aws('amplify', 'get-job', {'appId': app_id, 'branchName': 'main', 'jobId': deployment['jobId']})
            status = job['job']['summary']['status']
            if status == 'SUCCEED':
                print(json.dumps({'appId': app_id, 'jobId': deployment['jobId'],
                                  'website': 'https://main.' + app['defaultDomain']}, indent=2))
                return
            if status in ('FAILED', 'CANCELLED'):
                raise RuntimeError('Amplify deployment ' + status)
            time.sleep(5)
        raise RuntimeError('Deployment still running; inspect Amplify console.')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--frontend-only', action='store_true', help='Deploy static assets to the existing Amplify app only')
    parser.add_argument('--confirm-account', required=True)
    args = parser.parse_args()
    account = aws('sts', 'get-caller-identity')['Account']
    if not args.execute or account != args.confirm_account:
        raise SystemExit('Explicit execution and matching AWS account are required.')
    if args.frontend_only:
        app = aws('amplify', 'get-app', {'appId': 'dnpxbg1xuqcc'})['app']
        deploy_frontend(app)
        return
    name = 'rodloom-catalog'
    function_arn = f'arn:aws:lambda:{REGION}:{account}:function:{name}'
    log_group = '/aws/lambda/' + name
    groups = aws('logs', 'describe-log-groups', {'logGroupNamePrefix': log_group})['logGroups']
    if not any(g['logGroupName'] == log_group for g in groups):
        aws('logs', 'create-log-group', {'logGroupName': log_group})
    aws('logs', 'put-retention-policy', {'logGroupName': log_group, 'retentionInDays': 14})
    role_name = 'rodloom-catalog-execution'
    try:
        role = aws('iam', 'get-role', {'RoleName': role_name})['Role']
    except RuntimeError as exc:
        if 'NoSuchEntity' not in str(exc):
            raise
        role = aws('iam', 'create-role', {'RoleName': role_name, 'AssumeRolePolicyDocument': json.dumps({
            'Version': '2012-10-17', 'Statement': [{'Effect': 'Allow',
            'Principal': {'Service': 'lambda.amazonaws.com'}, 'Action': 'sts:AssumeRole'}]})})['Role']
        time.sleep(10)
    aws('iam', 'put-role-policy', {'RoleName': role_name, 'PolicyName': 'CatalogLogs',
        'PolicyDocument': json.dumps({'Version': '2012-10-17', 'Statement': [{
            'Effect': 'Allow', 'Action': ['logs:CreateLogStream', 'logs:PutLogEvents'],
            'Resource': f'arn:aws:logs:{REGION}:{account}:log-group:{log_group}:*'}]})})
    with tempfile.TemporaryDirectory() as temp:
        archive = Path(temp) / 'lambda.zip'
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
            for file in ['server.py', 'lambda_handler.py']:
                z.write(ROOT / file, file)
        functions = aws('lambda', 'list-functions')['Functions']
        config = {'FunctionName': name, 'Role': role['Arn'], 'Runtime': 'python3.13',
                  'Handler': 'lambda_handler.handler', 'Timeout': 29, 'MemorySize': 256}
        if any(f['FunctionName'] == name for f in functions):
            aws('lambda', 'update-function-code', {'FunctionName': name}, ['--zip-file', 'fileb://' + str(archive)])
            aws('lambda', 'wait', extra=['function-updated', '--function-name', name])
            aws('lambda', 'update-function-configuration', config)
            aws('lambda', 'wait', extra=['function-updated', '--function-name', name])
        else:
            for attempt in range(6):
                try:
                    aws('lambda', 'create-function', config, ['--zip-file', 'fileb://' + str(archive)])
                    break
                except RuntimeError as exc:
                    if 'cannot be assumed' not in str(exc) or attempt == 5:
                        raise
                    time.sleep(10)
            aws('lambda', 'wait', extra=['function-active-v2', '--function-name', name])
        apis = aws('apigatewayv2', 'get-apis')['Items']
        api = next((a for a in apis if a['Name'] == name), None)
        cors = {'AllowOrigins': ['*'], 'AllowMethods': ['GET'], 'AllowHeaders': ['content-type'], 'MaxAge': 3600}
        if not api:
            api = aws('apigatewayv2', 'create-api', {'Name': name, 'ProtocolType': 'HTTP',
                      'Target': function_arn, 'CorsConfiguration': cors})
        api_id = api['ApiId']
        api_logs = '/aws/apigateway/rodloom-catalog'
        groups = aws('logs', 'describe-log-groups', {'logGroupNamePrefix': api_logs})['logGroups']
        if not any(g['logGroupName'] == api_logs for g in groups):
            aws('logs', 'create-log-group', {'logGroupName': api_logs})
        aws('logs', 'put-retention-policy', {'logGroupName': api_logs, 'retentionInDays': 14})
        aws('apigatewayv2', 'update-stage', {'ApiId': api_id, 'StageName': '$default',
            'DefaultRouteSettings': {'ThrottlingBurstLimit': 20, 'ThrottlingRateLimit': 10},
            'AccessLogSettings': {'DestinationArn': f'arn:aws:logs:{REGION}:{account}:log-group:{api_logs}',
                'Format': json.dumps({'requestId': '$context.requestId', 'status': '$context.status',
                                     'routeKey': '$context.routeKey', 'integrationError': '$context.integrationErrorMessage'})}})
        try:
            aws('lambda', 'add-permission', {'FunctionName': name, 'StatementId': 'RodloomHttpApi',
                'Action': 'lambda:InvokeFunction', 'Principal': 'apigateway.amazonaws.com',
                'SourceAccount': account, 'SourceArn': f'arn:aws:execute-api:{REGION}:{account}:{api_id}/*/*'})
        except RuntimeError as exc:
            if 'ResourceConflictException' not in str(exc):
                raise
        endpoint = api['ApiEndpoint']
        apps = aws('amplify', 'list-apps')['apps']
        app = next((a for a in apps if a['name'] == 'rodloom'), None)
        settings = {'environmentVariables': {'RODLOOM_API_BASE': endpoint},
                    'buildSpec': (ROOT / 'amplify.yml').read_text(), 'platform': 'WEB'}
        if app:
            app = aws('amplify', 'update-app', {'appId': app['appId'], **settings})['app']
        else:
            app = aws('amplify', 'create-app', {'name': 'rodloom', **settings})['app']
        app_id = app['appId']
        branches = aws('amplify', 'list-branches', {'appId': app_id})['branches']
        if not any(b['branchName'] == 'main' for b in branches):
            aws('amplify', 'create-branch', {'appId': app_id, 'branchName': 'main', 'stage': 'PRODUCTION'})
        subprocess.run(['node', 'scripts/build.mjs'], cwd=ROOT,
                       env={**os.environ, 'RODLOOM_API_BASE': endpoint}, check=True)
        frontend = Path(temp) / 'frontend.zip'
        with zipfile.ZipFile(frontend, 'w', zipfile.ZIP_DEFLATED) as z:
            for file in (ROOT / 'dist').rglob('*'):
                if file.is_file():
                    z.write(file, file.relative_to(ROOT / 'dist').as_posix())
        deployment = aws('amplify', 'create-deployment', {'appId': app_id, 'branchName': 'main'})
        request = urllib.request.Request(deployment['zipUploadUrl'], data=frontend.read_bytes(), method='PUT')
        with urllib.request.urlopen(request, timeout=60) as response:
            response.read()
        aws('amplify', 'start-deployment', {'appId': app_id, 'branchName': 'main', 'jobId': deployment['jobId']})
        for _ in range(60):
            job = aws('amplify', 'get-job', {'appId': app_id, 'branchName': 'main', 'jobId': deployment['jobId']})
            status = job['job']['summary']['status']
            if status == 'SUCCEED':
                break
            if status in ('FAILED', 'CANCELLED'):
                raise RuntimeError('Amplify deployment ' + status)
            time.sleep(5)
        else:
            raise RuntimeError('Deployment still running; inspect Amplify console.')
        print(json.dumps({'appId': app_id, 'website': 'https://main.' + app['defaultDomain'],
                          'api': endpoint, 'githubConnected': bool(app.get('repository'))}, indent=2))


if __name__ == '__main__':
    main()
