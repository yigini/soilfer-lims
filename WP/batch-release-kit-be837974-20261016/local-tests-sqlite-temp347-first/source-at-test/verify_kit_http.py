"""Real local pipe children stand in for curl; no network or host operation."""
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from kit_contract import sha
from kit_ingress import Http,HTTP_BODY_LIMIT,HTTP_STATUS_PREFIX,HTTP_STREAM_LIMITS
from kit_io import CommandRunner

FIXTURES=pathlib.Path(__file__).parent/'http-local-retained-fixtures'

class HttpTransportTests(unittest.TestCase):
    def setup_transport(self,body,status=b'200',extra=b'',exit_code=0):
        FIXTURES.mkdir(exist_ok=True)
        root=pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()
        runner=CommandRunner(root,lambda _:None,require_directory_sync=os.name=='posix')
        launched=[];spawn=subprocess.Popen
        payload=body+HTTP_STATUS_PREFIX+status+extra
        def local(argv,**kwargs):
            launched.append(argv)
            return spawn([sys.executable,'-c',
                'import os,sys;os.write(1,'+repr(payload)+');sys.exit('+str(exit_code)+')'],**kwargs)
        return root,Http(root,runner),launched,local

    def test_body_and_marker_are_exact_binary_bytes_inside_one_original_stdout(self):
        body=bytes(range(256))+HTTP_STATUS_PREFIX+b'503'+b'\x00\xff'
        root,http,launched,spawn=self.setup_transport(body)
        with patch('kit_io.subprocess.Popen',side_effect=spawn):result=http.external('/api/health','GET',200)
        self.assertEqual(result['responseBody']['sha256'],sha(body))
        self.assertEqual(result['responseBody']['bytes'],len(body))
        self.assertEqual((root/'external-http-000001.stdout').read_bytes(),body+HTTP_STATUS_PREFIX+b'200')
        self.assertFalse(list(root.glob('*.body')))
        command=launched[0]
        self.assertEqual(command[command.index('--output')+1],'-')
        self.assertIn('--tlsv1.2',command);self.assertIn('=https',command)
        self.assertNotIn('--insecure',command)
        self.assertEqual(HTTP_STREAM_LIMITS['stdout'],HTTP_BODY_LIMIT+len(HTTP_STATUS_PREFIX)+3)

    def test_wrong_status_missing_suffix_and_failed_curl_never_become_http_success(self):
        for status,extra,code in [(b'503',b'',0),(b'200',b'x',0),(b'200',b'',23)]:
            root,http,launched,spawn=self.setup_transport(b'SYNTHETIC_BODY',status,extra,code)
            with patch('kit_io.subprocess.Popen',side_effect=spawn),self.assertRaises(RuntimeError):
                http.external('/api/health','GET',200)
            self.assertEqual(len(launched),1)
            self.assertTrue((root/'external-http-000001-command-result.json').is_file())

    def test_exact_body_boundary_and_burst_overflow_use_reserved_pipe_limits(self):
        limits={'stdout':256+len(HTTP_STATUS_PREFIX)+3,'stderr':64}
        for size in (256,257,8192):
            root,http,launched,spawn=self.setup_transport(b'B'*size)
            with patch('kit_io.subprocess.Popen',side_effect=spawn),patch('kit_ingress.HTTP_BODY_LIMIT',256),\
                 patch('kit_ingress.HTTP_STREAM_LIMITS',limits):
                if size==256:self.assertEqual(http.external('/api/health','GET',200)['responseBody']['bytes'],256)
                else:
                    with self.assertRaises(RuntimeError):http.external('/api/health','GET',200)
            result=json.loads((root/'external-http-000001-command-result.json').read_bytes())
            self.assertLessEqual(result['stdout']['bytes'],limits['stdout']+1)
            self.assertEqual(result['streamCapture']['allOriginalBytesRetained'],size==256)
            self.assertFalse(list(root.glob('*.body')))

    def test_unreviewed_endpoint_refuses_before_any_child_or_file(self):
        root,http,launched,spawn=self.setup_transport(b'')
        with patch('kit_io.subprocess.Popen',side_effect=spawn):
            for args in [('/admin','GET',200),('/login','POST',200),('/api/health','GET',201)]:
                with self.assertRaises(RuntimeError):http.external(*args)
        self.assertFalse(launched);self.assertFalse(list(root.iterdir()))

if __name__=='__main__':unittest.main()
