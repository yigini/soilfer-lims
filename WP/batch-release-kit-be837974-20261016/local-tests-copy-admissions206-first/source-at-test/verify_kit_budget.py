"""Consumption-aware all-stage reservation and physical/topology negatives."""
import copy
import unittest
from kit_budget import Budget,TABLE,DB_EQUIVALENTS,TOTAL_DB_COPIES,LOG_RESERVE
from kit_disk import BOUND,ALLOCATION,free_gate,disjoint_growth
from retained_accounting import mount_guard

class CopyBudgets(unittest.TestCase):
    def test_all37_maximum_copy_equivalents_keep_min64_and_original4gib_log_shares(self):
        self.assertEqual(TOTAL_DB_COPIES,37);self.assertEqual(DB_EQUIVALENTS,64)
        self.assertEqual(sum(r['logGrowthShareBytes'] for r in TABLE),4*1024**3)
        by_name={r['stage']:r for r in TABLE}
        self.assertEqual(by_name['candidate-startup']['dbTriples'],8)
        self.assertEqual(by_name['issue-214']['dbTriples'],7)
        self.assertEqual(by_name['issue-209']['dbTriples'],10)

    def test_complete_source_maxima_consume_once_without_doublecounting_own_active_stage(self):
        budget=Budget(600000000,6000000,414683521);initial=budget.required();seen=[]
        for row in TABLE:
            budget.begin(row['stage'],budget.required()+100000000000)
            for site,count in row['sites'].items():
                for i in range(count):
                    budget.claim(site)
                    if site in ('triple','backup','clone','assets'):budget.copy_ceiling(site)
            self.assertLessEqual(budget.required(),initial)
            result=budget.finish(row['stage'],0);seen.append(result)
        self.assertEqual(budget.remaining(),0);self.assertEqual(len(seen),len(TABLE))
        with self.assertRaises(RuntimeError):budget.begin('stopped-backup',100000000000)

    def test_missing_extra_or_new_copy_and_physical_overrun_refuse(self):
        budget=Budget(600000000,6000000,414683521);budget.begin('stopped-backup',100000000000)
        with self.assertRaises(RuntimeError):budget.finish('stopped-backup',0)
        with self.assertRaises(RuntimeError):budget.claim('undeclared')
        for site,count in TABLE[0]['sites'].items():
            for i in range(count):
                budget.claim(site)
                if site in ('triple','backup','clone','assets'):budget.copy_ceiling(site)
        with self.assertRaises(RuntimeError):budget.finish('stopped-backup',100000000000)
        with self.assertRaises(RuntimeError):budget.claim('backup')

    def test_same_filesystem_free_space_is_never_added_and_exact500mb_boundary_is_visible(self):
        required=30000000000
        def hardware(free):return {path:{'path':path,'device':7,'blockBytes':4096,'fragmentBytes':4096,
            'availableBlocks':free//4096,'freeBytes':free//4096*4096} for path in BOUND}
        with self.assertRaises(RuntimeError):free_gate(hardware(15000000000),required)
        self.assertGreaterEqual(free_gate(hardware(40000000000),required),required)
        before={'allocations':{p:{'bytes':1000,'device':7} for p in ALLOCATION},
            'devices':{p:7 for p in BOUND},'free':{p:40000000000 for p in BOUND}}
        after=copy.deepcopy(before)
        for p in BOUND:after['free'][p]-=500000000
        result=disjoint_growth(before,after);self.assertEqual(result[BOUND[0]]['unexplainedGrowthBytes'],500000000)
        after['free'][BOUND[0]]-=1
        with self.assertRaises(RuntimeError):disjoint_growth(before,after)

    def test_only_exact_known_overlay_views_with_counted_containerd_backing_are_accepted(self):
        identity='a'*64;base='/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/'
        text='47 20 0:52 / /var/lib/docker/rootfs/overlayfs/'+identity+' rw - overlay overlay rw,lowerdir=1/fs:2/fs,upperdir='+base+'3/fs,workdir='+base+'3/work\n'
        rows=mount_guard(text,ALLOCATION,[identity]);self.assertEqual(rows[0]['containerId'],identity)
        self.assertEqual(rows[0]['lowerdirs'],[base+'1/fs',base+'2/fs'])
        for changed,known in [(text,[]),(text.replace('1/fs:2/fs','../1/fs:2/fs'),[identity]),
            (text.replace(base+'3/work','/foreign/work'),[identity]),(text.replace('rw,lowerdir','rw,unknown=1,lowerdir'),[identity])]:
            with self.assertRaises(RuntimeError):mount_guard(changed,ALLOCATION,known)

if __name__=='__main__':unittest.main()
