"""Single-use Linux capture child; independent stop-post closes every outcome."""
import argparse
import os
from kit_contract import require
from kit_capture_owned import CAPTURE_ROOT
from kit_capture_construction import execute_capture


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--root',required=True);args=parser.parse_args()
    require(os.name=='posix' and args.root==CAPTURE_ROOT.as_posix(),'Exact Linux capture root required')
    execute_capture(CAPTURE_ROOT)
    return 0


if __name__=='__main__':raise SystemExit(main())
