The corrected measurement source is approved in #162 comment6113431945. ONE NEW isolated proof is running from `/opt/lims/releases/runtime-kobo-proof-171dd36c-20261011T203339Z`, unit `lims-owned-runtime-kobo-proof-171dd36c-20261011t203339z.service`, using the unchanged raw reviewed55c source and original valid171/bac52 build. At20:39:50UTC jobs-OFF readiness passed in113.030s, zero restarts/OOMfalse; that owned container is stopped/retained. The distinct jobs-ON container has started and is still in readiness, not a completed workload verdict. The prior200210Z FAILED receipt remains sealed. No production mutation, frozen kit or execution gate.

The proposed production packaging source is now 9d4999480cfe83374f08b6f18146692ac712e4a8. It binds source review6113431945, original proof tooling55c18943, reviewed coordinator9f175f13, V2 guardf88ec6a9, original guardf4712a7c, the explicit10-second confirmation deadline, and the original proof authority/index hashes through the manifest and fresh single-use gate. The collector also independently re-reads that source approval and refuses later source/audit failure. A source approval cannot substitute for the final exact-kit approval.

Raw Git source hashes:
- `deploy_runtime.py`: `333539829905ecd83109a59133ab9a44d3656e0e6620a12e565edb8b00256f7c`
- `freeze_runtime.py`: `86576e23ad524cf897fa58ad5a8879e0974370c92702a57a4e140b43f2d9e622`
- `runtime_release_contract.py`: `4f130afdc5521b038be13b6ac250b76e315e5dbb77ce88d07b37a84799519216`
- `collect_runtime_gate.py`: `07ebaaadfbaaf9a1ba39c97cbb7c9c82d20d924d9bdb8c65a58052a72f12f15c`
- `export_freeze_runtime_kit.py`: `da028460f82e8d90968e131d949e5a7d2d6cb841a2d551b5da34dc9e9350764b`

All67 Windows guards pass, and all67 exact-source Linux guards pass at20:38:56UTC (1.605003s,0failure/error/skip,no productionDBaccess). Linux stderr SHA2564bfa2591a1be6ae3e200375a944cb040a685525eef565c58db34b355ff142bdf. Six added authority-tampering cases cover stale source approval, guard/deadline changes, authority/index substitution, later source failure, incomplete review and stale proof receipt bindings.

This source is prepared for your read-only review while the SAME proof writer runs. The actual PASSED receipt and frozen manifest/coordinator/receipt hashes will follow only after the natural two-sync proof and stopped-copy preservation pass. The frozen exact-kit review and all fresh execution gates remain required before production. No replay, cleanup, restore, older image or heap/threshold override. Both workload pins remain `labAndHubBuildsOwnedByYY=true` / `RELEASE_DAY_DISK_ABORTS_ACCEPTED`. #291 formal pass6113454688 is retained; its merge stays held until #292 is live and your post-deploy check passes.
