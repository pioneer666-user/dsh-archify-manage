// node:dns/promises 的浏览器替身。
export const lookup = () => { throw new Error('node:dns.lookup 被调用了'); };
