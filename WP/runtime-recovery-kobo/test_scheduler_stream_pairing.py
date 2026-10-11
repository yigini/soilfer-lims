"""Exact #162/6114143349 cross-stream timing regressions; no host access."""
import hashlib
import pathlib
import unittest
from proof_contract import *


class StreamPairingTests(unittest.TestCase):
    def setUp(self):
        self.bound = [{'configId': key, 'labId': lab, 'projectCode': project, 'message': message}
            for key, lab, project, message in REFUSAL_TUPLES]

    def streams(self, ticks=1):
        stdout, stderr = [], []
        for tick in range(ticks):
            for i, row in enumerate(self.bound):
                stamp = '2026-10-11T21:%02d:00.%09dZ' % (tick, i * 100000)
                stdout.append(stamp + ' [KOBO_SCHEDULER] Triggering scheduled sync for Lab: ' +
                    row['labId'] + ', Project: ' + row['projectCode'])
                stderr.append(stamp + ' [KOBO_SCHEDULER] Error syncing lab ' + row['labId'] + ': ' + row['message'])
        return stdout, stderr

    def parse(self, out, err):
        return scheduler_refusals('\n'.join(out), '\n'.join(err), self.bound)

    def test_original_failed_run_logs_and_signed_negative_skew(self):
        fixtures = globals().get('__fixture_bytes__')
        if fixtures is None:
            base = pathlib.Path(__file__).parent / 'proof-failure-211630Z-original-logs'
            fixtures = {name: (base / name).read_bytes() for name in ['jobs-on.stdout.log', 'jobs-on.stderr.log']}
        expected = {'jobs-on.stdout.log': 'afa9312bf20f3266a9810ddd971d7112ea37b23a5e04229a391dbf696c27a16c',
            'jobs-on.stderr.log': '108edb92232ac4cec5eeb659c1a750025ebd0319e95fcb8ae6079ca860f47e1f'}
        for name, digest in expected.items(): self.assertEqual(hashlib.sha256(fixtures[name]).hexdigest(), digest)
        observed = scheduler_refusals(fixtures['jobs-on.stdout.log'].decode(), fixtures['jobs-on.stderr.log'].decode(), self.bound)
        negative = [row for row in observed if row['signedDeltaSeconds'] < 0]
        self.assertEqual(len(negative), 4)
        self.assertEqual(min(row['signedDeltaSeconds'] for row in negative), -0.000219442)
        self.assertEqual({row['configId'] for row in negative}, {row['configId'] for row in self.bound})
        self.assertTrue(all(row['triggerRawLine'].startswith(row['triggerUtc']) and
            row['errorRawLine'].startswith(row['utc']) and row['stdoutLineIndex'] > 0 and row['stderrLineIndex'] > 0
            for row in observed))

    def test_inclusive_one_second_bound_uses_nanosecond_precision(self):
        out, err = self.streams()
        err[0] = err[0].replace('00.000000000Z', '01.000000000Z')
        self.assertEqual(self.parse(out, err)[0]['signedDeltaSeconds'], 1)
        err[0] = err[0].replace('01.000000000Z', '01.000000001Z')
        with self.assertRaises(RuntimeError): self.parse(out, err)

    def test_one_point_five_second_skew_refuses(self):
        out, err = self.streams(); err[0] = err[0].replace('00.000000000Z', '01.500000000Z')
        with self.assertRaises(RuntimeError): self.parse(out, err)

    def test_extra_error_refuses(self):
        out, err = self.streams()
        with self.assertRaises(RuntimeError): self.parse(out, err + [err[-1]])

    def test_missing_middle_error_misaligns_next_tick_and_refuses(self):
        out, err = self.streams(2); del err[2]
        with self.assertRaises(RuntimeError): self.parse(out, err)

    def test_trailing_inflight_tick_is_allowed(self):
        out, err = self.streams(2)
        observed = self.parse(out, err[:4])
        self.assertEqual(len(observed), 4)

    def test_two_trailing_moz_triggers_refuse(self):
        out, err = self.streams(); out += [out[0], out[0]]
        with self.assertRaises(RuntimeError): self.parse(out, err)

    def test_four_trailing_tur_triggers_refuse(self):
        out, err = self.streams(); out += [out[1]] * 4
        with self.assertRaises(RuntimeError): self.parse(out, err)

    def test_wrong_stream_for_trigger_or_refusal_refuses(self):
        out, err = self.streams()
        for stdout, stderr in [(out + [err[0]], err), (out, err + [out[0]])]:
            with self.assertRaises(RuntimeError): self.parse(stdout, stderr)

    def test_interleaved_tur_triples_pair_in_stream_order(self):
        out, err = self.streams(3)
        observed = self.parse(out, err)
        self.assertEqual([row['configId'] for row in observed], [row['configId'] for row in self.bound] * 3)

    def test_reordered_stream_is_not_repaired_by_timestamp_sort(self):
        out, err = self.streams(2); err[0], err[4] = err[4], err[0]
        with self.assertRaises(RuntimeError): self.parse(out, err)

    def test_old_guard_and_verifier_bytes_stay_exact(self):
        import known_core_disk_guard, known_core_disk_guard_v2, known_core_disk_guard_v3, kobo_copy_preservation
        pairs = [(known_core_disk_guard, 'f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169'),
            (known_core_disk_guard_v2, 'f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c'),
            (known_core_disk_guard_v3, '878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f'),
            (kobo_copy_preservation, '3fc08d025de91f2716b0255027b2f5f1781b7cb920bb0cfaced5c9adb45b6b23')]
        for module, digest in pairs:
            raw_digest = getattr(module, '__raw_sha256__', None)
            if raw_digest is None:
                import subprocess
                path = pathlib.Path(module.__file__).as_posix().split('/WP/')[-1]
                raw_digest = hashlib.sha256(subprocess.check_output(['git', 'show', 'HEAD:WP/' + path])).hexdigest()
            self.assertEqual(raw_digest, digest)


if __name__ == '__main__': unittest.main()
