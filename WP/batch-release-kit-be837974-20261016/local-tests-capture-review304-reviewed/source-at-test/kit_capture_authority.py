"""Fresh source-only provider authority before capture host observations.

Import and construction are inert. A stored PASS is checked before provider
dispatch, then compared with fresh primary originals and every standing rule.
This grants no release gate, restart, serving permission or merge authority.
The separate complete capture package/launcher is still required.
"""
import pathlib
from kit_contract import canonical,require,sha
from kit_capture_owned import CAPTURE_ROOT,CAPTURE_UNIT
from kit_capture_budget import CAPTURE_TABLE_SHA
from kit_capture_copy import capture_source_review
from kit_authority import standing_authority,review_projection,no_later_release_direction
from kit_journal import exclusive_record,utc


class CaptureAuthority:
    def __init__(self,root,index,source,provider,require_directory_sync=True):
        require(pathlib.Path(root).as_posix()==CAPTURE_ROOT.as_posix(),'Exact separate capture authority root required')
        self.root=pathlib.Path(root);self.index=index;self.source=source;self.provider=provider
        self.sync=require_directory_sync;self.started=False;self.result=None

    def authorize(self):
        require(not self.started,'Capture authority refresh is single-use')
        self.started=True
        # No root, kernel, production metadata or stored host absence read may
        # precede this pure full-source PASS predicate and primary refresh.
        binding=capture_source_review(self.index,self.source)
        fresh=self.provider.source_snapshot(self.source['id'])
        from kit_package import write_new_file
        from kit_evidence import admit_evidence
        raw=canonical(fresh)+b'\n';admit_evidence(self.root/'capture-primary-snapshot.json',len(raw))
        original={'file':'capture-primary-snapshot.json',**write_new_file(
            self.root,'capture-primary-snapshot.json',raw,self.sync)}
        standing_authority(fresh)
        require(review_projection(fresh['source'])==review_projection(self.source),
            'Current capture source PASS was edited or replaced')
        require(capture_source_review(self.index,fresh['source'])==binding,'Fresh capture source binding differs')
        no_later_release_direction(fresh['releaseComments'],fresh['source'],fresh['source'])
        self.result={'root':self.root.as_posix(),'unit':CAPTURE_UNIT,'sourceBinding':binding,
            'captureTableSha256':CAPTURE_TABLE_SHA,'freshProviderSnapshotSha256':sha(canonical(fresh)),
            'primarySnapshotOriginal':{k:original[k] for k in ('file','sha256','bytes')},
            'collectionSeconds':fresh['collectionSeconds'],'collectedUtc':utc(),
            'readOnlyFreshAuthority':True,'releaseGateConsumed':False,'neverRetry':True}
        exclusive_record(self.root,'capture-fresh-authority.json',self.result,self.sync)
        return self.result
