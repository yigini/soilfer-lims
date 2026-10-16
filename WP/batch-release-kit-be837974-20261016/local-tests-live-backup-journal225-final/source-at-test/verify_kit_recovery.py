"""New local cgroup originals and exact source/serving-permit negatives only."""
import copy
import json
import pathlib
import subprocess
import tempfile
import types
import unittest
import os
import stat
from unittest.mock import patch
from kit_contract import HEAD,IMAGE,MEMORY_MAX,canonical,sha
from kit_runtime import PREDECESSOR_ID,ExactPredecessor,candidate_spec
from retained_memory import STAT_REQUIRED,EVENT_REQUIRED
from retained_health import load_health
from kit_recovery import RecoveryMemory,OLD_SWAP_MAX
from kit_stop_lifecycle import serving_permit
from verify_kit_runtime import old,new,Journal,IDENTITY
from retained_app_copy import APP_PINS,APP_PINS_SHA,validate_sources

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'recovery-local-retained-fixtures'

def directory():
    FIXTURES.mkdir(exist_ok=True);return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()


class RecoveryBoundaries(unittest.TestCase):
    def test_all_eight_original_kernel_reads_include_final_membership_and_unchanged_old_swap(self):
        root=directory();value=old();value['State'].update(Pid=9876,StartedAt='2026-10-16T12:00:00Z')
        reader=types.SimpleNamespace(inspect=lambda identity:copy.deepcopy(value))
        predecessor=ExactPredecessor(value,None,reader,None,Journal());predecessor.restarted=True
        def read(path,limit):
            name=pathlib.Path(path).name
            if name=='cgroup':return ('0::/system.slice/docker-'+PREDECESSOR_ID+'.scope\n').encode()
            if name=='mountinfo':return b'36 25 0:31 / /sys/fs/cgroup rw - cgroup2 cgroup rw\n'
            if name=='memory.stat':return ''.join(k+' 0\n' for k in sorted(STAT_REQUIRED)).encode()
            if name=='memory.events':return ''.join(k+' 0\n' for k in sorted(EVENT_REQUIRED)).encode()
            return (str({'memory.max':MEMORY_MAX,'memory.swap.max':OLD_SWAP_MAX,'memory.peak':MEMORY_MAX+4096}[name])+'\n').encode()
        memory=RecoveryMemory(root,predecessor,read,lambda p:{'path':str(p),'device':24,'inode':987})
        memory.observe('preapply-recovery-final')
        record=json.loads(next(root.glob('*memory-*.json')).read_text())
        self.assertEqual(len(record['raws']),8);self.assertEqual(record['raws'][-1]['kernelPath'],'/proc/9876/cgroup')
        for raw in record['raws']:
            b=(root/raw['file']).read_bytes();self.assertEqual(sha(b),raw['sha256']);self.assertEqual(len(b),raw['bytes'])
        self.assertEqual(record['swapMax'],OLD_SWAP_MAX);self.assertFalse(record['newCandidateSwap0Proof'])

    def test_actual_git_app_source_graph_revalidates_all458_sources_and_binds_copied_validator(self):
        binding=json.loads((HERE/'application-source-binding.json').read_bytes())
        self.assertEqual(binding['head'],HEAD);self.assertEqual(binding['sourceGraph'],APP_PINS)
        self.assertEqual(binding['sourceGraphSha256'],APP_PINS_SHA)
        raw=(HERE/'retained_app_copy.py').read_bytes()
        self.assertEqual(sha(raw),binding['copyValidatorSource']['sha256'])
        result=subprocess.run(['git','cat-file','--batch'],input=b''.join((HEAD+':'+name+'\n').encode() for name in APP_PINS),
            capture_output=True,check=True,cwd=HERE)
        at=0;raws={}
        for name in APP_PINS:
            end=result.stdout.index(b'\n',at);header=result.stdout[at:end].split();self.assertEqual(header[1],b'blob')
            size=int(header[2]);raws[name]=result.stdout[end+1:end+1+size];at=end+size+2
        self.assertEqual(at,len(result.stdout));derived=validate_sources(raws)
        self.assertEqual(derived['maximumPolicyDbTriplesPerStartup'],8)
        broken=dict(raws);broken['docker-entrypoint.sh']+=b'\nUNBOUND_COPY_PRODUCER'
        with self.assertRaises(RuntimeError):validate_sources(broken)

    def test_serving_permit_requires_complete_first_second_memory_and_exact_started_identity(self):
        root=directory();manifest={'syntheticOnly':True};manifest_sha=sha(canonical(manifest))
        spec=candidate_spec(old(),load_health(HERE));candidate=new(spec)
        from kit_runtime import candidate_projection
        projected=candidate_projection(candidate,spec,True)
        intent={'owner':spec['owner'],'specificationSha256':sha(canonical(spec))}
        receipt={'root':'/opt/lims/releases/workflow-batch-release-be837974-20261016T150000Z',
            'head':HEAD,'image':IMAGE,'sourceManifestSha256':manifest_sha,'status':'DEPLOYED_AWAITING_CLAUDIO_POSTCHECK',
            'ingressReopened':True,'anyApplyAttempted':True,'anyEntrypointAttempted':True,
            'candidateId':IDENTITY,'candidateIntent':intent,'candidateStartedIdentity':projected,
            'candidateMemory':{'hostBeforeControllerExitEventsChecked':True},
            'firstSync':{'sealedBeforeIngressReopens':True},'postflights':{'fullAllColumnStatePreserved':True},
            'secondSync':{'secondReceiptOnlyAfterReopen':True}}
        def save(name,value):
            p=root/name
            if p.exists():p.chmod(0o600)
            p.write_bytes(canonical(value)+b'\n');p.chmod(0o400)
        save('candidate-stop-intent.json',{'intent':intent,'privateSpecification':spec})
        save('candidate-started-identity.json',projected)
        save('production-gate-consumed.json',{'manifestSha256':manifest_sha,'exclusive':True})
        def records(value):
            save('production-receipt.json',value);raw=(root/'production-receipt.json').read_bytes()
            save('controller-completion-permit.json',{'root':value['root'],'manifestSha256':manifest_sha,
                'status':value['status'],'candidateId':IDENTITY,'candidateIntent':intent,
                'receipt':{'file':'production-receipt.json','sha256':sha(raw),'bytes':len(raw)}})
        records(receipt)
        call=lambda argv:json.dumps([candidate]).encode()
        # Windows read-only metadata reports0444, not Linux0400. Adapt only
        # stat's permission projection in this LOCAL fixture. The production
        # function and all actual file/hash/path predicates remain unchanged.
        actual_mode=stat.S_IMODE
        def local_mode(mode):
            value=actual_mode(mode)
            return 0o400 if os.name=='nt' and value==0o444 else value
        with patch('kit_stop_lifecycle.stat.S_IMODE',side_effect=local_mode):
            self.assertTrue(serving_permit(root,manifest,call)['leaveCandidateServing'])
            for field in ('secondSync','firstSync','candidateMemory','candidateStartedIdentity'):
                broken=copy.deepcopy(receipt);del broken[field];records(broken)
                with self.subTest(field=field),self.assertRaises(RuntimeError):serving_permit(root,manifest,call)
            records(receipt);candidate['State']['StartedAt']='CHANGED'
            with self.assertRaises(RuntimeError):serving_permit(root,manifest,call)

