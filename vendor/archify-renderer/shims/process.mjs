// 最小 process 垫片。浏览器没有 process，而 Archify 的模块顶层会读它。
// 只提供编译路径真正用到的成员：env / argv / cwd / on / stderr / stdout / exit / pid。
if (typeof globalThis.process === 'undefined') {
  globalThis.process = {
    env: {},
    argv: [],
    cwd: () => '/',
    on: () => {},
    off: () => {},
    once: () => {},
    exit: () => { throw new Error('process.exit 被调用了'); },
    pid: 0,
    platform: 'browser',
    version: 'browser',
    stderr: { fd: 2, write: () => {} },
    stdout: { fd: 1, write: () => {} },
  };
}
