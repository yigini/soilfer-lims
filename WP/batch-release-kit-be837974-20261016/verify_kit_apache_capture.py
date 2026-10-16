"""NEW LOCAL Apache inputs only; no Apache/Linux/host behavior is claimed."""
import copy
import os
import pathlib
import tempfile
import unittest
from unittest.mock import patch
import kit_apache_capture as apache
from kit_contract import sha

FIXTURES=pathlib.Path(__file__).parent/'apache-copy-local-retained-fixtures'


def local_directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()


def local_metadata(value):
    # LOCAL Windows path/fd creation-time projection only. Production's complete
    # Linux stat/ctime predicate is unchanged and is not tested by this stand-in.
    result=ORIGINAL_METADATA(value)
    if os.name!='posix':result['st_ctime_ns']=0
    return result


ORIGINAL_METADATA=apache.metadata


def original(newline=b'\n'):
    # This is a new synthetic configuration, not a retained production original.
    return newline.join([b'# NEW LOCAL synthetic Apache profile',
        *(b'    '+line.encode() for line in apache.PROFILE),b''])


class ApacheCapture(unittest.TestCase):
    def setUp(self):
        if os.name!='posix':
            local=patch.object(apache,'metadata',side_effect=local_metadata)
            local.start();self.addCleanup(local.stop)

    def test_supported_complete_profile_preserves_every_original_byte_and_adds_only_https_rule(self):
        for newline in (b'\n',b'\r\n'):
            raw=original(newline);held,proof=apache.render_held(raw)
            offset=proof['insertionByteOffset']
            inserted=b'    RewriteEngine On'+newline+b'    RewriteRule .* - [R=503,L]'+newline+newline
            self.assertEqual(held,raw[:offset]+inserted+raw[offset:])
            self.assertLess(raw.index(b':443>'),offset)
            self.assertTrue(proof['originalBytesPreservedVerbatim'])
            self.assertFalse(proof['syntaxOrServingTestClaimed'])
            with self.assertRaises(RuntimeError):apache.render_held(held)

    def test_unknown_nested_included_error_document_proxy_tls_address_or_rewrite_directives_refuse(self):
        raw=original()
        variants=[raw+b'Include /some/file\n',raw+b'ErrorDocument 503 /fallback\n',
            raw.replace(b'ProxyPreserveHost On',b'<IfModule mod_proxy.c>\nProxyPreserveHost On\n</IfModule>'),
            raw.replace(b'ProxyPreserveHost On',b'RewriteEngine On\nProxyPreserveHost On'),
            raw.replace(b'46.19.33.37:443',b'*:443'),raw.replace(b'SSLEngine on',b'SSLEngine off'),
            raw.replace(b'127.0.0.1:3000',b'127.0.0.1:3001'),raw.replace(b'ProxyRequests Off',b'ProxyRequests On'),
            raw.replace(b'ProxyRequests Off\n',b''),raw+raw,raw.replace(b'ServerName',b'UnknownDirective',1),
            raw.replace(b'ProxyRequests Off',b'ProxyRequests Off # inline comment'),
            raw.replace(b'ProxyRequests Off',b'ProxyRequests \\\n Off')]
        for changed in variants:
            with self.subTest(sha=sha(changed)),self.assertRaises(RuntimeError):apache.render_held(changed)

    def test_mixed_endings_controls_invalid_utf8_or_oversize_refuse(self):
        for changed in (b'',b'x'*(apache.LIMIT+1),original().replace(b'\n',b'\r\n',1),
            original()+b'\x00',original()+b'\x0c',original()+b'\xff',original().replace(b'\n',b'\r')):
            with self.subTest(sha=sha(changed)),self.assertRaises((RuntimeError,UnicodeDecodeError)):
                apache.render_held(changed)

    def test_stable_new_local_file_retains_bytes_mode_owner_identity_and_complete_attributes(self):
        directory=local_directory();source=directory/'new-synthetic-apache.conf';raw=original();source.write_bytes(raw)
        attrs={'user.local-test':b'\x00\xffopaque'}
        with patch.object(apache,'attributes',side_effect=[attrs,attrs]):
            before=source.stat();captured,held,value=apache.read_apache(source,False)
        self.assertEqual(captured,raw);self.assertEqual(source.read_bytes(),raw)
        self.assertEqual(value['before'],value['after'])
        self.assertEqual(value['originalSha256'],sha(raw));self.assertEqual(value['heldSha256'],sha(held))
        self.assertEqual(value['extendedAttributesBase64'],{'user.local-test':'AP9vcGFxdWU='})
        self.assertEqual(value['sourceWrites'],0);self.assertEqual(value['certificateOrPrivateKeyFilesOpened'],0)
        self.assertEqual(before.st_mtime_ns,source.stat().st_mtime_ns)
        self.assertFalse(value['configurationInstalled'])

    def test_attribute_or_content_race_and_hardlinked_input_refuse(self):
        directory=local_directory();source=directory/'new-synthetic-apache.conf';source.write_bytes(original())
        with patch.object(apache,'attributes',side_effect=[{}, {'user.changed':b'x'}]),self.assertRaises(RuntimeError):
            apache.read_apache(source,False)
        calls=[]
        def race(path,production):
            calls.append(path)
            if len(calls)==1:source.write_bytes(original()+b'# source changed during read\n')
            return {}
        with patch.object(apache,'attributes',side_effect=race),self.assertRaises(RuntimeError):
            apache.read_apache(source,False)
        os.link(source,directory/'retained-second-name.conf')
        with self.assertRaises(RuntimeError):apache.read_apache(source,False)

    def test_missing_actual_source_review_refuses_before_source_read_or_output(self):
        directory=local_directory()
        with patch.object(apache,'read_apache',side_effect=AssertionError('must not read')):
            with self.assertRaises(RuntimeError):apache.capture_apache(directory,{}, {},False)
        self.assertEqual(list(directory.iterdir()),[])

    def test_local_capture_standin_writes_exact_independent_outputs_and_consumes_intent_before_read(self):
        directory=local_directory();source=directory/'new-synthetic-apache.conf';source.write_bytes(original())
        output=directory/'capture';output.mkdir()
        with patch.object(apache,'source_review',return_value={'LOCAL_TEST_STANDIN_ONLY':True}):
            refs=apache.capture_apache(output,{}, {'id':6213266960},False,source)
            with self.assertRaises(RuntimeError):apache.capture_apache(output,{}, {'id':6213266960},False,source)
        self.assertEqual(set(refs),{'ingress-original.conf','ingress-held.conf','apache-capture.json'})
        self.assertEqual((output/'ingress-original.conf').read_bytes(),source.read_bytes())
        from kit_provider import timestamp
        from retained_contract import exact_json
        timestamp(exact_json((output/'apache-capture.json').read_bytes())['capturedAt'])
        for name,row in refs.items():
            path=output/name;self.assertEqual(sha(path.read_bytes()),row['sha256']);self.assertEqual(path.stat().st_nlink,1)
        failed=directory/'failed-capture';failed.mkdir()
        with patch.object(apache,'source_review',return_value={'LOCAL_TEST_STANDIN_ONLY':True}),\
            patch.object(apache,'read_apache',side_effect=RuntimeError('local refusal')):
            with self.assertRaises(RuntimeError):apache.capture_apache(failed,{}, {'id':6213266960},False,source)
            self.assertTrue((failed/'apache-capture-intent.json').is_file())
            with self.assertRaisesRegex(RuntimeError,'already consumed'):
                apache.capture_apache(failed,{}, {'id':6213266960},False,source)


if __name__=='__main__':unittest.main()
