"""Explicit maintenance task: bundle fixed-source catalog photos for offline serving.

Run from the repository: python scripts/localize_catalog.py
Normal builds and page views never download retailer images.
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import sys
import time
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server

ASSETS = ROOT / 'assets'
SWATCHES = ASSETS / 'swatches'


def image_extension(content):
    if content.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'png'
    if content.startswith(b'\xff\xd8\xff'):
        return 'jpg'
    if content.startswith((b'GIF87a', b'GIF89a')):
        return 'gif'
    if content.startswith(b'RIFF') and content[8:12] == b'WEBP':
        return 'webp'
    raise ValueError('Upstream response is not a supported image')


def localize(item):
    original = item['image']
    parsed = urllib.parse.urlsplit(original)
    if parsed.scheme != 'https' or parsed.hostname != 'cdn.shopify.com':
        raise ValueError('Missing trusted image for ' + item['id'])
    # Match the existing local proxy cache to avoid unnecessary downloads.
    url = original + ('&' if '?' in original else '?') + 'width=120&format=jpg'
    cache = server.CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.img')
    content = cache.read_bytes() if cache.exists() else None
    for attempt in range(3):
        try:
            if content is None:
                content = server.fetch(url)
            extension = image_extension(content)
            break
        except Exception:
            content = None
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
    filename = hashlib.sha256(content).hexdigest() + '.' + extension
    (SWATCHES / filename).write_bytes(content)
    return dict(item, image='assets/swatches/' + filename)


def main():
    server.CACHE.mkdir(parents=True, exist_ok=True)
    SWATCHES.mkdir(parents=True, exist_ok=True)
    catalog = server.get_catalog()
    expected = {(brand, line) for brand, line, _, _ in server.SOURCES}
    actual = {(item['brand'], item['line']) for item in catalog['items']}
    if not expected.issubset(actual):
        raise RuntimeError('Incomplete catalog; refusing to replace bundled snapshot')
    # Never publish a partial manifest: an upstream failure leaves the last one intact.
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        items = list(pool.map(localize, catalog['items']))
    manifest = dict(catalog, items=items, localizedAt=time.time())
    temporary = ASSETS / 'catalog.json.tmp'
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(ASSETS / 'catalog.json')
    print(f'Localized {len(items)} catalog entries; {len(set(i["image"] for i in items))} unique images.')


if __name__ == '__main__':
    main()
