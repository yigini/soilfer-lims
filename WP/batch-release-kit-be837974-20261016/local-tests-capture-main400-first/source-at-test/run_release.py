"""One Linux systemd controller entry point for the complete exact frozen kit.

No resume, retry, automatic gate creation or historical operation import. The
independent stdlib ExecStopPost handles even import/construction failures.
"""
import argparse
import os
from kit_contract import require
from retained_contract import ROOT
from kit_construction import construct
from kit_sequence import execute


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--root',required=True);args=parser.parse_args()
    require(os.name=='posix' and args.root==str(ROOT),'Exact Linux release root required')
    ops,plan=construct(ROOT)
    result=execute(ops,plan)
    # The actual receipt remains private until the parent reviews it. This
    # constant summary is never substituted for the independent stop-post.
    print('Release controller closed; retain all originals and inspect exact receipt/stop-post')
    return 0 if result['status']=='DEPLOYED_AWAITING_CLAUDIO_POSTCHECK' else 1


if __name__=='__main__':raise SystemExit(main())
