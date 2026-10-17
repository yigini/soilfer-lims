/* Native Unix SQLite temporary-directory preconditions, before child launch.
 * This routes the first environment candidate; it does not bound file sizes,
 * prove every SQL producer, or retain SQLite's unlinked temporary files.
 */
'use strict';
const fs = require('node:fs');
function need(ok, message) { if (!ok) throw Error(message); }
function temporaryDirectory(directory, { env = process.env, platform = process.platform, io = fs } = {}) {
  need(platform === 'linux' && directory === '/tmp', 'Exact Linux retained temporary mount required');
  for (const key of ['SQLITE_TMPDIR', 'TMPDIR', 'TMP', 'TEMP'])
    need(env[key] === '/tmp', 'Exact native and application temporary environment required');
  for (const name of ['/', '/tmp']) {
    const value = io.lstatSync(name, { bigint: true });
    need(value.isDirectory() && !value.isSymbolicLink() && io.realpathSync(name) === name,
      'Native temporary directory ancestor alias refused');
  }
  const before = io.lstatSync(directory, { bigint: true });
  need((before.mode & 0o7777n) === 0o700n, 'Private retained temporary directory mode required');
  const fd = io.openSync(directory, io.constants.O_RDONLY | (io.constants.O_DIRECTORY || 0) |
    (io.constants.O_NOFOLLOW || 0));
  let closed = false;
  function check() {
    need(!closed, 'Native temporary directory lease already closed');
    const named = io.lstatSync(directory, { bigint: true }), opened = io.fstatSync(fd, { bigint: true });
    need(named.isDirectory() && !named.isSymbolicLink() && opened.isDirectory() &&
      io.realpathSync(directory) === directory && ['dev', 'ino', 'mode', 'uid', 'gid'].every(
        key => before[key] === named[key] && before[key] === opened[key]),
      'Retained native temporary directory identity or permissions changed');
    // The pinned unixTempFileDir uses POSIX access(...,03): write + search.
    // A successful file creation alone does not prove that same predicate.
    io.accessSync(directory, io.constants.W_OK | io.constants.X_OK);
  }
  function close() { if (!closed) { closed = true; io.closeSync(fd); } }
  try { check(); } catch (error) { close(); throw error; }
  return { check, close };
}
module.exports = { temporaryDirectory };
