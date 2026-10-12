"""PROPOSED measurement confirmation; requires a NEW source review and proof.

Historical guard bytes are imported unchanged. A missing previously measured
active core can trigger a ten-second read-only confirmation deadline. No
vanished blocks receive credit: only a fresh sample passing the original
500 MB residual check permits progress. The reserve is checked every sample.
"""
import time
import release_support as s
import startup_common as c
from known_core_disk_guard import (
    KnownCoreDiskGuard as OriginalGuard, core_allocations,
    stable_allocations, allocated_on_device,
)

LIMIT = 500000000
CONFIRM_SECONDS = 10


def residual(before, sample):
    return {path: max(0, before[path] - sample['freeBytes'][path] -
        sample['explainedAllocationGrowthBytes'][path]) for path in before}


def confirm_disappearance(before, devices, previous, initial, sample, record,
                          clock=time.monotonic, sleeper=time.sleep):
    """A fresh actual free-space sample must pass; never carry vanished credit."""
    unexplained = residual(before, initial)
    if max(unexplained.values()) <= LIMIT:
        return initial
    # A previously paired active inode must be gone from the after-scan.
    # It may have disappeared inside this sample, or immediately before it.
    present = {(row['device'], row['inode']) for row in
        initial['coreAllocationsAfterFreeSample']}
    vanished = [row for row in previous if row['kind'] == 'active-systemd-core' and
        (row['device'], row['inode']) not in present]
    amounts = {path: allocated_on_device(vanished, device) for path, device in devices.items()}
    # Confirmation is unavailable for an unexplained drop that exceeds the
    # physical blocks of previously paired, active cores on that filesystem.
    eligible = vanished and all(value <= LIMIT or value - LIMIT <= amounts[path]
        for path, value in unexplained.items())
    if not eligible:
        s.check_drop(before, initial['freeBytes'], initial['explainedAllocationGrowthBytes'])
        raise RuntimeError('Original disk refusal unexpectedly returned')
    record({'stage': 'pending-measured-core-deallocation', 'initialUnexplainedDropBytes': unexplained,
        'vanishedPairedActiveCores': vanished, 'confirmationDeadlineSeconds': CONFIRM_SECONDS,
        'vanishedAllocationCreditBytes': 0, 'forwardProgressAllowed': False})
    deadline = clock() + CONFIRM_SECONDS
    current = initial
    while clock() < deadline:
        sleeper(min(1, max(0, deadline - clock())))
        current = sample()  # Each sample enforces the reserve immediately.
        unexplained = residual(before, current)
        if clock() > deadline:
            break  # An I/O operation finishing late cannot permit progress.
        if max(unexplained.values()) <= LIMIT:
            record({'stage': 'fresh-sample-confirmed', 'unexplainedDropBytes': unexplained,
                'vanishedAllocationCreditBytes': 0, 'forwardProgressAllowed': True})
            return current
    record({'stage': 'core-deallocation-confirmation-refused',
        'unexplainedDropBytes': residual(before, current),
        'vanishedAllocationCreditBytes': 0, 'forwardProgressAllowed': False})
    # Persistent unexplained growth keeps the original message and threshold.
    s.check_drop(before, current['freeBytes'], current['explainedAllocationGrowthBytes'])
    raise RuntimeError('Known core disappearance confirmation exceeded 10-second deadline')


class KnownCoreDiskGuard(OriginalGuard):
    def __init__(self, root, reserve):
        super().__init__(root, reserve)
        # Baseline's union/max records cannot qualify as a paired successful
        # observation. At least one original-threshold sample must pass first.
        self.previous_paired_success = []

    def physical_sample(self):
        first_cores = core_allocations()
        first_root = c.allocation(self.root)
        free = s.disk_free()
        assert min(free.values()) >= self.reserve, 'Reserve floor refused'
        root_growth = max(0, min(first_root, c.allocation(self.root)) - self.root_before)
        second_cores = core_allocations()
        current = stable_allocations(first_cores, second_cores)
        explained = {}
        for path, device in self.devices.items():
            growth = max(0, allocated_on_device(current, device) -
                allocated_on_device(self.core_before, device))
            explained[path] = growth + (root_growth if device == self.root_device else 0)
        value = {'stage': 'physical-sample', 'freeBytes': free, 'rootGrowthBytes': root_growth,
            'coreAllocationsBeforeFreeSample': first_cores,
            'coreAllocationsAfterFreeSample': second_cores, 'coreAllocations': current,
            'explainedAllocationGrowthBytes': explained}
        self.record(value)
        return value

    def check(self):
        observed = confirm_disappearance(self.before, self.devices,
            self.previous_paired_success, self.physical_sample(), self.physical_sample, self.record)
        drop = s.check_drop(self.before, observed['freeBytes'], observed['explainedAllocationGrowthBytes'])
        self.previous_paired_success = observed['coreAllocations']
        return {**observed, 'unexplainedDropBytes': drop}
