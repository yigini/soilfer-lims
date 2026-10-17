"""Disclosure covers all source phases and preserves honest timing contexts."""
import copy
import json
import pathlib
import unittest
from kit_contract import PHASES,READY_SECONDS,UNIT_SECONDS,canonical
from kit_outage import proposal,ALLOWANCES

HERE=pathlib.Path(__file__).resolve().parent


class Outage(unittest.TestCase):
    def test_full_disclosure_is_the_exact_generated_proposal_with_explicit_unmeasured_allowances(self):
        timing=json.loads((HERE/'timing-evidence.json').read_bytes());value=proposal(timing)
        self.assertEqual(json.loads((HERE/'whole-outage-disclosure.json').read_bytes()),value)
        self.assertEqual(set(value['phaseEstimates']),set(PHASES))
        self.assertEqual(len(ALLOWANCES),20)
        self.assertEqual(value['candidateReadinessSeconds'],READY_SECONDS)
        self.assertEqual(value['controllerMaximumSeconds'],UNIT_SECONDS)
        self.assertTrue(value['failureMaintenanceCanContinueBeyondController'])
        self.assertTrue(value['noNewInstallerTransactionKillPoints'])
        self.assertGreater(value['expectedMinutesRoundedUp'],10)
        self.assertLess(value['expectedOutageSeconds'],4800)
        self.assertIn('separately reviewed forward fix',value['plainGateText'])
        for name in ALLOWANCES:self.assertIn('has not been measured',value['phaseEstimates'][name]['basis'])

    def test_old_install_and_new_already_installed_startup_cannot_be_relabelled_one_production_measurement(self):
        timing=json.loads((HERE/'timing-evidence.json').read_bytes())
        for field in ('historicalInstallerHead','currentHead','comparisonIsNotMeasurementOfOneProductionSequence'):
            changed=copy.deepcopy(timing);changed[field]=False
            with self.subTest(field=field),self.assertRaises(RuntimeError):proposal(changed)


if __name__=='__main__':unittest.main()
