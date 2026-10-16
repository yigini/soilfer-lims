"""Per-run private keyed evidence. Never expose payload leaves or raw errors."""
import hashlib,hmac,json,os,pathlib
from proof_contract import require,canonical,sha,child_path
REFUSALS=frozenset({'ec5a5a67-3f5a-4682-88df-edb0e07e6485','f24b4f7a-1da7-4320-831e-b9105647f106','a9fc2329-cdfc-408e-aeb2-fa1a9020e66d','edfc27ed-adfe-44f8-8ef6-f159f3ba2fc0'})
SAMPLE_FIELDS=frozenset({'metadata','fieldMetadata','rejectionReason','updatedAt'})
REJECTION='PROVENANCE_HOLD: Conflicting field submissions claimed this barcode'
HOLD_ACTIVE='AMBIGUOUS_PROVENANCE_HOLD'
CROSS_REASON='CONFLICTING_FIELD_SUBMISSIONS: Multiple field submissions claimed this barcode with conflicting survey evidence'
PRIMARY_REASON='REVISED_FIELD_EVIDENCE: Primary occurrence re-submitted with conflicting survey coordinates or attachments'
INTRA_REASON='INTRA_SUBMISSION_DUPLICATE_DEPTH: Field surveyor assigned identical barcode to D1 and D2'
INTRA_REJECTION='PROVENANCE_HOLD: Ambiguous depth identity (D1/D2 duplicate barcode)'
_value_key=None
def install_value_key(key):
    global _value_key
    require(_value_key is None and type(key) is bytes and len(key)==32,'Fresh private32-byte key required');_value_key=key
def initialize_private_key(root):
    root=pathlib.Path(root);p=child_path(root,root/'private-value-hmac-key.json')
    key=os.urandom(32)
    with p.open('xb') as f:f.write(canonical({'algorithm':'HMAC-SHA256','keyHex':key.hex(),'withheld':True})+b'\n')
    p.chmod(0o400);install_value_key(key)
def projection(v):
    if isinstance(v,bytes):return {'blobHex':v.hex()}
    if isinstance(v,(tuple,list)):return [projection(x) for x in v]
    if isinstance(v,dict):return {k:projection(x) for k,x in v.items()}
    return v
def value_hash(v):
    require(type(_value_key) is bytes and len(_value_key)==32,'Private value key missing')
    return hmac.new(_value_key,canonical(projection(v)),hashlib.sha256).hexdigest()
def public_failure(e):return {'errorType':type(e).__name__,'errorHmacSha256':value_hash(str(e))}
def strict(raw):
    require(isinstance(raw,(str,bytes)) and len(raw)<=8*1024**2,'Bounded JSON required')
    def pairs(items):
        out={}
        for k,v in items:require(k not in out,'Duplicate JSON key');out[k]=v
        return out
    def nonfinite(_):raise RuntimeError('Nonfinite JSON refused')
    return json.loads(raw,object_pairs_hook=pairs,parse_constant=nonfinite)
