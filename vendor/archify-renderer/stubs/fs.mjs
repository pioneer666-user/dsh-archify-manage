// node:fs 的浏览器替身。编译路径不应调用它；一调用就抛错以便暴露。
function boom() { throw new Error('node:fs 被调用了（编译路径不该用到它）'); }
export default new Proxy({}, { get: () => boom });
