// node:crypto 的浏览器替身。
export const createHash = () => { throw new Error('node:crypto.createHash 被调用了'); };
export const randomUUID = () => { throw new Error('node:crypto.randomUUID 被调用了'); };
