"""Read-only HTTP API adapter; shares the local server's fixed-source catalog."""
import base64
import json
import os
import urllib.parse

os.environ['RODLOOM_CACHE_DIR'] = '/tmp/rodloom-catalog'
import server


def response(status, body, content_type='application/json', encoded=False):
    return {'statusCode': status, 'headers': {'Content-Type': content_type,
            'Cache-Control': 'public, max-age=3600' if status == 200 else 'no-store'},
            'body': body, 'isBase64Encoded': encoded}


def handler(event, context):
    if event.get('requestContext', {}).get('http', {}).get('method') != 'GET':
        return response(405, json.dumps({'error': 'Method not allowed'}))
    try:
        path = event.get('rawPath', '')
        if path == '/api/catalog':
            return response(200, json.dumps(server.get_catalog()))
        if path == '/api/swatch':
            ident = (event.get('queryStringParameters') or {}).get('id', '')
            item = next((i for i in server.get_catalog()['items'] if i['id'] == ident), None)
            if not item or not item['image']:
                return response(404, json.dumps({'error': 'Swatch not found'}))
            url = item['image'] + ('&' if '?' in item['image'] else '?') + 'width=120&format=jpg'
            # Only catalog-provided Shopify URLs are fetched, never caller-provided URLs.
            if urllib.parse.urlsplit(url).hostname != 'cdn.shopify.com':
                return response(404, json.dumps({'error': 'Swatch not found'}))
            cache = server.CACHE / (server.hashlib.sha256(url.encode()).hexdigest() + '.img')
            if not cache.exists():
                cache.write_bytes(server.fetch(url))
            return response(200, base64.b64encode(cache.read_bytes()).decode(), 'image/jpeg', True)
        return response(404, json.dumps({'error': 'Not found'}))
    except Exception as exc:
        print('Catalog request failed:', type(exc).__name__)
        return response(502, json.dumps({'error': 'Catalog source unavailable. Try again later.'}))
