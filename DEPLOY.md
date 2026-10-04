# AWS deployment

## Current deployment

- Region: `us-west-2`
- Amplify app: `dnpxbg1xuqcc`, branch `main`
- Website: https://main.dnpxbg1xuqcc.amplifyapp.com
- Public catalog HTTP API: https://304heq9dze.execute-api.us-west-2.amazonaws.com
- Lambda: `rodloom-catalog` (Python 3.13, 256 MB, 29-second timeout)
- Execution role: `rodloom-catalog-execution`, scoped to writing the function's logs only
- API throttle: 10 requests/second, burst 20; logs retained for 14 days

The public API serves only GET catalog/swatch requests. No caller-provided URL is fetched. CORS allows public, non-credentialed requests, including cross-origin image sampling. Cached files live in Lambda's temporary storage and may disappear at any time. Cold instances refetch the fixed retailer catalogs. The 8-second upstream timeout bounds latency. Review the retailer's terms/permission before broad redistribution. Hosting, API, Lambda, and logging can incur charges; throttling is not a hard spending cap.

## Connect GitHub for frontend auto-deploys

The initial deployment was uploaded directly, without obtaining or storing a GitHub token. GitHub is **not yet connected**.

1. Open the [Amplify app console](https://us-west-2.console.aws.amazon.com/amplify/apps/dnpxbg1xuqcc/overview).
2. Connect the existing app to GitHub through Amplify's repository settings/connection flow. Authorize the AWS Amplify GitHub app for `jaywolters/rodloom` only and select `main`.
3. Use the committed `amplify.yml` build settings. Ensure the app environment variable `RODLOOM_API_BASE` remains `https://304heq9dze.execute-api.us-west-2.amazonaws.com`.
4. Enable automatic builds and verify a GitHub-triggered build completes successfully.

Amplify builds `dist/` with an explicit frontend file allowlist; Python, deployment scripts, and Git history are not published. `config.js` is generated with the public API URL; this URL is not a secret. Backend updates are **not** automatically deployed by Amplify.

## Deploy/redeploy both backend and frontend manually

Requires AWS CLI v2, Python 3, Node.js, AWS credentials with deployment permissions, and running from this repository. No Python packages are required.

```sh
node --test geometry.test.js
python -m unittest test_lambda_handler.py
python scripts/deploy.py --execute --confirm-account 355609608739
```

The script updates or creates the named Lambda, IAM execution role, HTTP API, log groups, and Amplify app/branch, then uploads a frontend deployment. It refuses an account mismatch. Resources are managed directly with the AWS CLI, not CloudFormation. To change region/account, review the script and resource names first. Avoid concurrent deployments. The script replaces the app's environment-variable map with the catalog endpoint; preserve additional variables if introducing them later.

## Local development

Run `python server.py`. The committed `config.js` uses the local `/api` endpoints. Build output is ignored by Git.

## Domain

`rodloom.com` has not been connected. Existing canonical/social/robots/sitemap URLs assume that domain. Configure it under Amplify Domain management and verify ownership/DNS before treating that domain as live. No DNS records were changed by this deployment.
