// 源码证据展示的纯函数部分（步骤 4/D）：不含 DOM，Node 可直接加载验证（.runtime/check-d.mjs）。
// 输入形状 = 服务端 /api/evidence 的返回（src/core/evidence.ts 的 EvidenceResult）。

/**
 * 服务端把报错拼成「refs[0]（bad-commit）：原因」；页面上编号与 id 已单独展示，
 * 这里剥掉前缀只留人话原因。前缀对不上（形状变了）就原样返回，不吞错误。
 */
export function displayError(error) {
  const stripped = error.replace(/^refs\[\d+\]（[^：]*）：/, '')
  return stripped || error
}

/** 代码片段拼成带行号的整段文本（行号 = 文件里的真实行号，从 fromLine 起）。 */
export function formatCodeBlock(text, fromLine) {
  const lines = text.split('\n')
  const width = String(fromLine + lines.length - 1).length
  return lines.map((line, i) => `${String(fromLine + i).padStart(width)} │ ${line}`).join('\n')
}

/** 汇总一行：几条证据、几条有效、几条有问题。没有引用时返回 null（不显示汇总）。 */
export function evidenceSummary(refs) {
  if (!refs.length) return null
  const ok = refs.filter((ref) => ref.ok).length
  return { total: refs.length, ok, bad: refs.length - ok }
}

/** 有效引用的出处说明（一行）：文件 · 行范围 · 固定提交（短号）。 */
export function describeSource(ref) {
  return `文件 ${ref.path} · 第 ${ref.fromLine}–${ref.toLine} 行 · 固定提交 ${ref.commit.slice(0, 8)}`
}
