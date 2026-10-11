"""Account measured core-dump allocation; retain the 500MB unexplained-drop abort.

No files are removed, opened for content, modified, or disabled. This proposed
guard needs Claudio's review before a NEW proof. Historical guards stay frozen.
"""
import json, os, pathlib, re, stat
import release_support as s
import startup_common as c

CORE_ROOT = pathlib.Path('/var/lib/systemd/coredump')

def core_allocations(core_root=CORE_ROOT, proc_root=pathlib.Path('/proc'), errors=None):
    found = {}
    def unreadable(path, error):
        if errors is not None:
            errors.append({'path':str(path), 'errorType':type(error).__name__})
    def add(path, descriptor):
        try:
            st = path.stat()
            if not stat.S_ISREG(st.st_mode):
                return
            key = (st.st_dev, st.st_ino)
            record = {'device': st.st_dev, 'inode': st.st_ino,
                'blocks': st.st_blocks, 'allocatedBytes': st.st_blocks * 512, **descriptor}
            found[key] = record
        except OSError as error:
            unreadable(path, error)
    if core_root.exists():
        for file in core_root.iterdir():
            if file.name.startswith('core.') and not file.is_symlink():
                pid = re.search(r'\.(\d+)\.\d+\.(?:zst|lz4|xz)$', file.name)
                add(file, {'kind': 'retained-systemd-core', 'name': file.name,
                    'dumpedProcessFromFilename': int(pid.group(1)) if pid else None})
    for process in proc_root.iterdir():
        if not process.name.isdigit():
            continue
        try:
            comm = (process / 'comm').read_text().strip()
            if comm not in ['systemd-coredum', 'systemd-coredump']:
                continue
            for fd in (process / 'fd').iterdir():
                try:
                    target = os.readlink(fd)
                    if target.startswith(str(core_root) + '/'):
                        add(fd, {'kind': 'active-systemd-core', 'process': int(process.name),
                            'fd': fd.name, 'target': target})
                except OSError as error:
                    unreadable(fd, error)
        except OSError as error:
            unreadable(process, error)
    # Device/inode de-duplication counts an open compressed output only once
    # when it also appears in the retained core directory.
    return sorted(found.values(), key=lambda row: (row['device'], row['inode']))

def allocated_on_device(records, device):
    return sum(row['allocatedBytes'] for row in records if row['device'] == device)

def stable_allocations(before, after):
    """Credit only blocks observed on the same inode on both sides of df."""
    old = {(row['device'], row['inode']): row for row in before}
    return [{**row, 'allocatedBytes': min(row['allocatedBytes'], old[key]['allocatedBytes']),
        'blocks': min(row.get('blocks', row['allocatedBytes'] // 512),
            old[key].get('blocks', old[key]['allocatedBytes'] // 512))}
        for row in after if (key := (row['device'], row['inode'])) in old]

class KnownCoreDiskGuard:
    def __init__(self, root, reserve):
        self.root = root
        self.reserve = reserve
        self.baseline_errors = []
        first_cores = core_allocations(errors=self.baseline_errors)
        first_root = c.allocation(root)
        self.before = s.disk_free()
        self.root_before = max(first_root, c.allocation(root))
        # Conservatively retain the greater baseline block count per inode from
        # either side of df; a disappearing baseline core cannot create credit.
        baseline = {}
        for row in first_cores + core_allocations(errors=self.baseline_errors):
            key = (row['device'], row['inode'])
            if key not in baseline or baseline[key]['allocatedBytes'] < row['allocatedBytes']:
                baseline[key] = row
        self.core_before = list(baseline.values())
        self.devices = {path: pathlib.Path(path).stat().st_dev for path in self.before}
        self.root_device = root.stat().st_dev
        self.record({'stage': 'baseline', 'freeBytes': self.before,
            'rootAllocatedBytes': self.root_before, 'coreAllocations': self.core_before,
            'baselineEnumerationErrors': self.baseline_errors,
            'baselineEnumerationErrorCount': len(self.baseline_errors)})
        if self.baseline_errors:
            raise RuntimeError('Unreadable baseline allocation; refuse attribution credit')

    def record(self, value):
        with (self.root / 'disk-allocation-observations.jsonl').open('a', encoding='utf-8') as out:
            out.write(json.dumps({'utc': s.utc(), **value}, ensure_ascii=False) + '\n')

    def check(self):
        first_cores = core_allocations()
        first_root = c.allocation(self.root)
        free = s.disk_free()
        assert min(free.values()) >= self.reserve, 'Reserve floor refused'
        root_growth = max(0, min(first_root, c.allocation(self.root)) - self.root_before)
        second_cores = core_allocations()
        current_cores = stable_allocations(first_cores, second_cores)
        explained = {}
        for path, device in self.devices.items():
            core_growth = max(0, allocated_on_device(current_cores, device)
                - allocated_on_device(self.core_before, device))
            explained[path] = core_growth + (root_growth if device == self.root_device else 0)
        observed = {'freeBytes': free, 'rootGrowthBytes': root_growth,
            'coreAllocationsBeforeFreeSample': first_cores,
            'coreAllocationsAfterFreeSample': second_cores,
            'coreAllocations': current_cores, 'explainedAllocationGrowthBytes': explained}
        self.record(observed)
        # Same original refusal and threshold. Only explicitly measured physical
        # blocks on each guarded filesystem are classified as explained.
        drop = s.check_drop(self.before, free, explained)
        return {**observed, 'unexplainedDropBytes': drop}
