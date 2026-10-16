"""Fresh provider authority and exact frozen workload/impact gate binding.

No external action or approval happens at import/construction. Preflight must
read real provider originals and current host metadata; consume_gate repeats
the volatile provider/human checks immediately before exclusive consumption.
Historical source PASS and caller boolean flags cannot authorize this kit.
"""
import time
from kit_contract import (HEAD,IMAGE,POSTFLIGHT_POLICY,canonical,sha,require,acceptance,
    timing_direction,whole_outage_disclosure)
from retained_contract import ROOT,exact_json
from retained_authority import (current,qualified,rule_authorities,post_reboot_authorities,
    memory_authority,jobs_scope_authority,diagnostic_accepted,step2_authorities,attempt_authorities,
    authority_projection,canonical as accepted_canonical)
from kit_frozen import source_review,kit_review,human_gate_comment,consume_gate
from kit_stop_lifecycle import private_file,frozen_hook_authority
from kit_consumer_inventory import require_reviewed_inventory
from kit_journal import exclusive_record
from kit_science import verify_scientific_originals,verify_reviewed_impact

APP_AUDIT_SEMANTIC_PINS={
    '6146939836':'da1bc79f539aec798bbe9aa2c0ac4b2088f4af2b5ffd004139a53b36dc936840',
    '6163165778':'f916d64dc3f774dd7bb19b36aa956ef7843a7c3722ed86607537eb3c6c18135e',
    '6178123314':'27f5f92d95a70b9c694790dc4bc57b4c016181833c9dce5cc5627b4b8b4253ef',
    '6195167175':'85100e149d5cdd07d8bcc241a5f83aac47c74273e0c18dfa9a138916972c61b8',
}


def review_projection(record):
    """Provider field-order/additional metadata noise is outside body authority."""
    return {key:record.get(key) for key in ('id','body','created_at','updated_at','issue_url','html_url',
        'performed_via_github_app','user')}


def no_later_release_direction(comments,source,kit):
    require(isinstance(comments,list),'Complete fresh release comment inventory required')
    for row in comments:
        app=row.get('performed_via_github_app') or {}
        if app.get('id')!=1236702 or app.get('slug')!='claude':continue
        if row.get('id') in (source['id'],kit['id']):continue
        # An unknown later instruction can narrow scope even without repeating
        # the head/root or the literal words "audit failed". Refuse it until a
        # new concrete exact-kit review incorporates the instruction.
        if max(row.get('created_at',''),row.get('updated_at',''))>=source['created_at']:
            raise RuntimeError('New or edited actual release direction requires a new exact review')
    return True


def standing_authority(value):
    current(value['main'],value['ci'],value['prs'],value['verdicts'],value['comments'])
    require({str(v.get('id')) for v in value['verdicts'].values()}==set(APP_AUDIT_SEMANTIC_PINS),
        'All four original application verdict bodies required')
    for verdict in value['verdicts'].values():
        require(sha(accepted_canonical(authority_projection(verdict)))==APP_AUDIT_SEMANTIC_PINS[str(verdict['id'])],
            'Original full application verdict body or identity changed')
    require(value['issue191'].get('number')==191 and value['issue191'].get('state')=='closed',
        'Issue191 current closed authority required')
    rule_authorities(value['rules'],value['r2Accepted'])
    post_reboot_authorities(value['postRebootAuthorities'])
    memory_authority(value['memoryDirection']);jobs_scope_authority(value['jobsScope'])
    diagnostic_accepted(value['diagnosticAccepted']);step2_authorities(value['step2Authorities'])
    attempt_authorities(value['attemptAuthorities'])
    acceptance(value['acceptance']);timing_direction(value['timingDirection'])


def reviewed_plan(manifest,disclosure,kit_result):
    require(disclosure==whole_outage_disclosure(disclosure.get('phaseEstimates')),
        'Complete exact whole-outage disclosure differs')
    require(sha(canonical(disclosure))==manifest['wholeOutageDisclosureSha256'],
        'Whole-outage disclosure is not bound to exact kit')
    require(type(manifest.get('wholeOutageSeconds')) is int and
        disclosure['expectedOutageSeconds']<=manifest['wholeOutageSeconds']<=4800,
        'Reviewed whole-outage boundary exceeds controller headroom')
    return {'completeReviewedOperationalGraph':True,'exactKitReviewPassed':True,'head':HEAD,'image':IMAGE,
        'postflightPolicy':POSTFLIGHT_POLICY,'wholeOutageSeconds':manifest['wholeOutageSeconds'],
        'manifestSha256':kit_result['manifestSha256'],'exactKitReviewId':kit_result['id']}


class Authority:
    def __init__(self,root,provider,manifest,index,source,kit,confirmation,disclosure,
                 consumer_reader,ingress_reader,image_reader,clock=time.time,require_directory_sync=True):
        require(str(root)==str(ROOT),'Exact new release authority root required')
        self.root=root;self.provider=provider;self.manifest=manifest;self.index=index
        self.source=source;self.kit=kit;self.confirmation=confirmation;self.disclosure=disclosure
        self.consumer_reader=consumer_reader;self.ingress_reader=ingress_reader;self.image_reader=image_reader
        self.clock=clock;self.sync=require_directory_sync;self.manifest_sha=sha(canonical(manifest))
        self.plan=None;self.preflight_value=None;self.human=None;self.kit_result=None;self.consumed=False;self.started=False
        self.science=None

    def preflight(self,plan):
        require(not self.started and not self.consumed,'Fresh authority preflight is single-use')
        self.started=True
        frozen=frozen_hook_authority(self.root)
        require(frozen==self.manifest,'Runtime manifest differs from immutable full frozen package')
        def frozen_json(name):return exact_json(private_file(self.root,name))
        require(frozen_json('source-index.json')==self.index and frozen_json('source-review.json')==self.source and
            frozen_json('exact-kit-review.json')==self.kit and frozen_json('yy-confirmation.json')==self.confirmation and
            frozen_json('whole-outage-disclosure.json')==self.disclosure,'Runtime review inputs differ from retained originals')
        snapshot=self.provider.snapshot(self.source['id'],self.kit['id'],self.confirmation['commentId'])
        standing_authority(snapshot)
        require(review_projection(snapshot['source'])==review_projection(self.source) and
            review_projection(snapshot['kit'])==review_projection(self.kit),'Actual current exact review was edited or replaced')
        source_review(snapshot['source'],self.index)
        self.kit_result=kit_review(snapshot['kit'],self.manifest,self.index,snapshot['source'])
        no_later_release_direction(snapshot['releaseComments'],snapshot['source'],snapshot['kit'])
        self.human=snapshot['human']
        human_gate_comment(self.human,self.confirmation,self.clock(),self.disclosure,self.manifest_sha,self.kit_result)
        self.plan=reviewed_plan(self.manifest,self.disclosure,self.kit_result)
        require(plan==self.plan,'Caller plan does not equal independently authenticated exact-kit plan')
        self.science=frozen_json('actual-scientific-impact.json')
        require(sha(canonical(self.science))==self.manifest['actualScientificImpactSha256'],
            'Full scientific impact capture is not bound to exact kit')
        verify_scientific_originals(self.science,lambda name:private_file(self.root,name))
        from kit_provider import timestamp
        require(self.science['captureSourceReviewId']==self.source['id'] and
            timestamp(self.source['created_at'])<=timestamp(self.science['capturedAt'])<=timestamp(self.kit['created_at']),
            'Actual impact capture must follow this exact source PASS and precede this kit PASS')
        review=frozen_json('consumer-review.json')
        require(sha(canonical(review))==self.manifest.get('consumerReviewSha256'),
            'Allowed consumer classes are not bound to frozen kit')
        consumer=require_reviewed_inventory(self.consumer_reader('preflight'),review)
        require(consumer['reviewedConfigurationSha256']==self.manifest['consumerConfigurationSha256'],
            'Current unhealthy-consumer inventory differs from exact kit')
        raw=self.ingress_reader()
        require(isinstance(raw,bytes) and sha(raw)==self.manifest['originalIngressSha256'] and
            raw==private_file(self.root,'ingress-original.conf'),'Current Apache bytes changed before quiesce')
        build=private_file(self.root,'qualified-build-receipt.json')
        qualified(exact_json(build),build,self.image_reader())
        self.preflight_value={'manifestSha256':self.manifest_sha,'sourceReviewId':self.source['id'],
            'exactKitReviewId':self.kit['id'],'humanCommentId':self.human['id'],
            'currentAuthoritySha256':sha(canonical(snapshot)),'consumer':consumer,
            'providerCollectionSeconds':snapshot['collectionSeconds'],'readOnlyFreshAuthority':True}
        exclusive_record(self.root,'fresh-production-authority.json',self.preflight_value,self.sync)
        return self.preflight_value

    def review_impact(self,issue,actual):
        require(self.science is not None and self.consumed,'Fresh exact scientific gate must precede installer impact')
        return verify_reviewed_impact(self.science,issue,actual)

    def consume_gate(self):
        require(self.preflight_value is not None and not self.consumed,'Successful fresh preflight before exclusive gate required')
        self.consumed=True # Lost consumption return never permits redispatch.
        fresh=self.provider.gate_refresh(self.source,self.kit,self.human)
        require(fresh['main'].get('object',{}).get('sha')==HEAD,'Main changed immediately before gate')
        for name,original in (('source',self.source),('kit',self.kit),('human',self.human)):
            require(review_projection(fresh[name])==review_projection(original),'Gate authority edited during preflight')
        source_review(fresh['source'],self.index)
        result=kit_review(fresh['kit'],self.manifest,self.index,fresh['source'])
        no_later_release_direction(fresh['releaseComments'],fresh['source'],fresh['kit'])
        now=self.clock()
        human=human_gate_comment(fresh['human'],self.confirmation,now,self.disclosure,self.manifest_sha,result)
        # Host configuration is re-read after provider collection, so a lengthy
        # network snapshot cannot conceal a changed ingress/consumer class.
        require(sha(self.ingress_reader())==self.manifest['originalIngressSha256'],'Apache changed before exclusive gate')
        consumer=require_reviewed_inventory(self.consumer_reader('gate'),exact_json(private_file(self.root,'consumer-review.json')))
        require(consumer['reviewedConfigurationSha256']==self.manifest['consumerConfigurationSha256'],
            'Unhealthy-consumer configuration changed before exclusive gate')
        now=self.clock()
        human_gate_comment(fresh['human'],self.confirmation,now,self.disclosure,self.manifest_sha,result)
        gate={'root':str(ROOT),'manifestSha256':self.manifest_sha,'status':'FRESH_SINGLE_USE_AUTHORIZED',
            'humanConfirmed':True,'createdEpoch':now,'humanCreatedEpoch':human['createdEpoch'],
            'humanBodySha256':human['humanBodySha256'],'humanCommentId':human['humanCommentId'],
            'exactKitReviewId':self.kit['id'],'neverRetry':True}
        return consume_gate(self.root,gate,self.manifest_sha,now,self.sync)
