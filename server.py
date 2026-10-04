"""Local Rod Loom server with a cached, fixed-source size D catalog."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import threading
import time
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / '.catalog-cache'
SOURCES = [
    ('ProWrap', 'ColorFast', 'regular', 'prowrap-colorfast-rod-winding-thread-size-d-100-yds'),
    ('ProWrap', 'Nylon', 'regular', 'prowrap-nylon-rod-winding-thread-size-d-100-yds'),
    ('ProWrap', 'Metallic', 'metallic', 'prowrap-metallic-rod-winding-thread-size-d-100-yds'),
    ('Fuji', 'Ultra Poly NOCP', 'regular', 'fuji-ultra-poly-nocp-rod-building-thread-100m-spool'),
    ('Fuji', 'Ultra Poly', 'regular', 'fuji-ultra-poly-rod-building-thread-100m-spool'),
    ('Fuji', 'Ultra Poly Metallic', 'metallic', 'fuji-ultra-poly-metallic-rod-building-thread-100m-spool'),
]
lock = threading.Lock()


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'RodLoom-local-catalog/1.0'})
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read(8_000_000)


def load_source(source):
    brand, line, finish, slug = source
    path = CACHE / (slug + '.json')
    stale = False
    try:
        if not path.exists() or time.time() - path.stat().st_mtime > 86400:
            data = json.loads(fetch('https://mudhole.com/products/' + slug + '.js'))
            if not isinstance(data.get('variants'), list):
                raise ValueError('Missing variants')
            path.write_text(json.dumps(data), encoding='utf-8')
        else:
            data = json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        if not path.exists():
            return [], line + ' unavailable'
        data = json.loads(path.read_text(encoding='utf-8'))
        stale = True
    options = [o['name'].lower() for o in data['options']]
    size_index = next((i for i, name in enumerate(options) if name in ('size', 'thread diameter')), None)
    color_index = next((i for i, name in enumerate(options) if name == 'color'), 0)
    result = []
    for v in data['variants']:
        if size_index is not None and v['options'][size_index].lower() != 'size d':
            continue
        if size_index is None and 'size-d' not in slug:
            continue  # Never guess the size for a product without an explicit D option.
        color = v['options'][color_index]
        image = (v.get('featured_image') or {}).get('src', '')
        if not image.startswith('https://cdn.shopify.com/'):
            image = ''
        result.append(dict(id=str(v['id']), brand=brand, line=line, name=color,
                           code=color.split(' ')[0], sku=v.get('sku', ''), size='D',
                           finish='neon' if 'neon' in color.lower() else finish,
                           image=image, available=v.get('available', False),
                           source='https://mudhole.com/products/' + slug + '?variant=' + str(v['id'])))
    return result, (line + ' uses an older cached catalog') if stale else None


catalog = None
catalog_time = 0


def get_catalog():
    global catalog, catalog_time
    with lock:
        if catalog is not None and time.time() - catalog_time < (60 if catalog['warnings'] else 86400):
            return catalog
        CACHE.mkdir(exist_ok=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            results = list(pool.map(load_source, SOURCES))
        catalog = dict(items=[item for items, _ in results for item in items],
                       warnings=[warning for _, warning in results if warning],
                       source='Mud Hole', fetchedAt=time.time())
        catalog_time = time.time()
        return catalog


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        try:
            if parsed.path == '/api/catalog':
                self.send_body(json.dumps(get_catalog()).encode(), 'application/json')
            elif parsed.path == '/api/swatch':
                ident = urllib.parse.parse_qs(parsed.query).get('id', [''])[0]
                item = next((i for i in get_catalog()['items'] if i['id'] == ident), None)
                if not item or not item['image']:
                    self.send_error(404)
                    return
                url = item['image'] + ('&' if '?' in item['image'] else '?') + 'width=120&format=jpg'
                path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.img')
                if not path.exists():
                    content = fetch(url)
                    path.write_bytes(content)
                self.send_body(path.read_bytes(), 'image/jpeg', 'public, max-age=86400')
            elif parsed.path.startswith('/.'):
                self.send_error(404)
            else:
                super().do_GET()
        except Exception as exc:
            print('Request failed:', exc)
            self.send_error(502, 'Catalog source unavailable. Try again later.')

    def send_body(self, body, content_type, cache='no-cache'):
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', cache)
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    print('Rod Loom: http://localhost:8000', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8000), Handler).serve_forever()
