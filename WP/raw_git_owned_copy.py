"""Export verified raw Git blobs into a new owned review directory."""
import hashlib, json, pathlib, subprocess, sys

head, target = sys.argv[1:]
assert len(head) == 40 and all(c in '0123456789abcdef' for c in head)
root = pathlib.Path(target)
assert not root.exists(), 'Review directory must be new'
rows = []
for line in subprocess.check_output(['git', 'ls-tree', '-r', '-z', head]).split(b'\0'):
    if not line:
        continue
    meta, raw_name = line.split(b'\t')
    mode, kind, blob = meta.decode().split()
    name = raw_name.decode()
    assert kind == 'blob' and mode in ['100644', '100755', '120000']
    assert not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts
    rows.append({'path': name, 'mode': mode, 'blob': blob})
objects = subprocess.check_output(['git', 'cat-file', '--batch'],
    input=('\n'.join(row['blob'] for row in rows) + '\n').encode())
root.mkdir()
offset = 0
for row in rows:
    newline = objects.index(b'\n', offset)
    blob, kind, size = objects[offset:newline].decode().split()
    assert blob == row['blob'] and kind == 'blob'
    offset = newline + 1
    size = int(size)
    data = objects[offset:offset + size]
    offset += size
    assert objects[offset:offset + 1] == b'\n'
    offset += 1
    actual_blob = hashlib.sha1(('blob ' + str(size) + '\0').encode() + data).hexdigest()
    assert actual_blob == blob
    row.update(bytes=size, sha256=hashlib.sha256(data).hexdigest())
    # Never materialize repository symlinks pointing out of the owned copy.
    if row['mode'] != '120000':
        destination = root / row['path']
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open('xb') as out:
            out.write(data)
assert offset == len(objects)
index = {'head': head, 'entries': rows, 'regularFiles': sum(row['mode'] != '120000' for row in rows)}
with (root / 'raw-git-source-index.json').open('x', encoding='utf-8') as out:
    json.dump(index, out, indent=2)
print(json.dumps({'root': str(root), 'head': head, 'regularFiles': index['regularFiles']}))
