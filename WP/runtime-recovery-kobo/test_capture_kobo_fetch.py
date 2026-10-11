"""Network and secret boundaries of the read-only upstream evidence capture."""
import contextlib
import io
import json
import pathlib
import sqlite3
import tempfile
import unittest
from unittest.mock import patch, Mock
from capture_kobo_fetch import capture, NoRedirect


class FetchGuardTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='lims-owned-fetch-guard-')
        self.addCleanup(self.directory.cleanup)
        self.database = pathlib.Path(self.directory.name) / 'backup.db'
        with contextlib.closing(sqlite3.connect(self.database)) as db, db:
            db.execute('CREATE TABLE KoboConfig(id TEXT,labId TEXT,projectCode TEXT,isActive INTEGER,koboServerUrl TEXT,formId TEXT,apiToken TEXT,lastSubmissionId TEXT)')
            db.execute("INSERT INTO KoboConfig VALUES('cfg','ZMB','P',1,'https://kobo.example','form','synthetic-secret','0')")

    def response(self, ids, next_page=False):
        return io.BytesIO(json.dumps({'results': [{'_id': value, 'privateField': 'never-serialize'} for value in ids],
            'next': 'not-followed-url' if next_page else None}).encode())

    def test_pages_discard_content_and_use_get_actual_cursor(self):
        opener = Mock()
        opener.open.side_effect = [self.response(range(1, 1001), True), self.response([1001])]
        with patch('capture_kobo_fetch.urllib.request.build_opener', return_value=opener):
            result = capture(self.database, ['cfg'])
        self.assertEqual(len(result['cfg']['submissionIds']), 1001)
        self.assertNotIn('synthetic-secret', json.dumps(result))
        self.assertNotIn('never-serialize', json.dumps(result))
        self.assertEqual(opener.open.call_args_list[0].args[0].get_method(), 'GET')
        self.assertIn('start=1000', opener.open.call_args_list[1].args[0].full_url)

    def test_cursor_ignored_refuses(self):
        opener = Mock()
        opener.open.return_value = self.response([7])
        with patch('capture_kobo_fetch.urllib.request.build_opener', return_value=opener):
            with self.assertRaisesRegex(RuntimeError, 'ignored actual cursor'):
                capture(self.database, ['cfg'], {'cfg': '7'})

    def test_duplicate_upstream_id_refuses(self):
        opener = Mock()
        opener.open.return_value = self.response([7, 7])
        with patch('capture_kobo_fetch.urllib.request.build_opener', return_value=opener):
            with self.assertRaisesRegex(RuntimeError, 'duplicate upstream'):
                capture(self.database, ['cfg'])

    def test_redirect_never_forwards_credentials(self):
        with self.assertRaisesRegex(RuntimeError, 'redirect refused'):
            NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.example')

    def test_unencrypted_origin_refuses_before_fetch(self):
        with contextlib.closing(sqlite3.connect(self.database)) as db, db:
            db.execute("UPDATE KoboConfig SET koboServerUrl='http://kobo.example'")
        opener = Mock()
        with patch('capture_kobo_fetch.urllib.request.build_opener', return_value=opener):
            with self.assertRaisesRegex(RuntimeError, 'HTTPS Kobo origin'):
                capture(self.database, ['cfg'])
        opener.open.assert_not_called()


if __name__ == '__main__':
    unittest.main(verbosity=2)
