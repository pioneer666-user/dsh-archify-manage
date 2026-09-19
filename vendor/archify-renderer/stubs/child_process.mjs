// node:child_process 的浏览器替身。
export const spawnSync = () => { throw new Error('node:child_process.spawnSync 被调用了'); };
