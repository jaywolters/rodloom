import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import lambda_handler as api


def event(path, method='GET', query=None):
    return {'rawPath': path, 'requestContext': {'http': {'method': method}},
            'queryStringParameters': query}


class HandlerTests(unittest.TestCase):
    def test_catalog(self):
        catalog = {'items': [{'id': '123'}], 'warnings': []}
        with patch.object(api.server, 'get_catalog', return_value=catalog):
            result = api.handler(event('/api/catalog'), None)
        self.assertEqual(result['statusCode'], 200)
        self.assertEqual(json.loads(result['body']), catalog)

    def test_unknown_path_and_method(self):
        self.assertEqual(api.handler(event('/missing'), None)['statusCode'], 404)
        self.assertEqual(api.handler(event('/api/catalog', 'POST'), None)['statusCode'], 405)

    def test_unknown_id_does_not_fetch_arbitrary_url(self):
        with patch.object(api.server, 'get_catalog', return_value={'items': []}), patch.object(api.server, 'fetch') as fetch:
            result = api.handler(event('/api/swatch', query={'id': 'https://example.com'}), None)
        self.assertEqual(result['statusCode'], 404)
        fetch.assert_not_called()

    def test_swatch_binary_and_cache(self):
        catalog = {'items': [{'id': '123', 'image': 'https://cdn.shopify.com/image.jpg'}]}
        with tempfile.TemporaryDirectory() as temp, patch.object(api.server, 'CACHE', Path(temp)), patch.object(api.server, 'get_catalog', return_value=catalog), patch.object(api.server, 'fetch', return_value=b'jpeg') as fetch:
            result = api.handler(event('/api/swatch', query={'id': '123'}), None)
            again = api.handler(event('/api/swatch', query={'id': '123'}), None)
        self.assertEqual(result['statusCode'], 200)
        self.assertTrue(result['isBase64Encoded'])
        self.assertEqual(result['body'], 'anBlZw==')
        self.assertEqual(again, result)
        fetch.assert_called_once()

    def test_upstream_failure(self):
        with patch.object(api.server, 'get_catalog', side_effect=TimeoutError):
            result = api.handler(event('/api/catalog'), None)
        self.assertEqual(result['statusCode'], 502)
        self.assertEqual(result['headers']['Cache-Control'], 'no-store')


if __name__ == '__main__':
    unittest.main()
