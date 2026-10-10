# Publishing Rod Loom

## Hosting

- AWS Amplify app: `dnpxbg1xuqcc`
- Branch: `main`
- Region: `us-west-2`
- Website: https://main.dnpxbg1xuqcc.amplifyapp.com

The site includes its catalog and swatch images in `assets/`. Builds validate and copy these bundled files without downloading catalog content.

## Publish

Requires Node.js, Python 3, AWS CLI v2, and AWS credentials with deployment permissions. Run from the repository root:

```sh
node --test
python scripts/deploy.py --frontend-only --execute --confirm-account 355609608739
```

The deployment command builds `dist/`, packages the static files and assets, uploads them to the Amplify `main` branch, and waits for completion. It refuses an AWS account mismatch. Avoid concurrent deployments.

The build uses an explicit frontend file allowlist; deployment scripts, Python source, and Git history are not published.

## GitHub automatic publishing

To configure automatic builds, connect `jaywolters/rodloom` and branch `main` through the [Amplify console](https://us-west-2.console.aws.amazon.com/amplify/apps/dnpxbg1xuqcc/overview). Use the committed `amplify.yml` build settings, enable automatic builds, and verify a GitHub-triggered build succeeds.

## Refresh catalog assets

Run `python scripts/localize_catalog.py`, review and commit the updated files in `assets/`, then publish. Review retailer terms before redistributing catalog content.

## Custom domain

Configure the domain in Amplify Domain management and verify its DNS records. Keep canonical and social URLs in `index.html`, `robots.txt`, and `sitemap.xml` aligned with the public domain.
