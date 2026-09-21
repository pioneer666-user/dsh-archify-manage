// 节点源码对照：只认文案中显式的“（证据 编号）”，不按相似名称推断关联。
import { findSection, splitInline } from './details.js'
import { describeSource, displayError, formatCodeBlock } from './evidence.js'

const make = (tag, cls, text) => {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

// 围栏内的示例不作为证据声明，也不把示例中的标题拆成业务步骤。
export function detailGroups(body) {
  const groups = []
  let lines = [], title = '', fence = null
  const flush = () => {
    if (!title && !lines.join('').trim()) return
    const text = lines.join('\n').trim()
    let inFence = null
    const declarations = text.split('\n').filter(line => {
      const mark = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
      if (mark) {
        if (!inFence) inFence = mark
        else if (mark[0] === inFence[0] && mark.length >= inFence.length) inFence = null
        return false
      }
      return !inFence
    }).join('\n')
    const ids = [...declarations.matchAll(/[（(]证据\s+([^）)\n]+)[）)]/g)]
      .flatMap(match => match[1].split(/[、，,；;\s]+/)).filter(Boolean)
    groups.push({ title, body: text, ids: [...new Set(ids)] })
    lines = []
  }
  for (const line of String(body || '').split(/\r?\n/)) {
    const mark = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    if (fence) {
      lines.push(line)
      if (mark && mark[0] === fence[0] && mark.length >= fence.length && !line.trim().slice(mark.length).trim()) fence = null
      continue
    }
    if (mark) { fence = mark; lines.push(line); continue }
    const heading = /^###\s+(.+?)\s*#*\s*$/.exec(line)
    if (heading) { flush(); title = heading[1]; continue }
    // 没有子标题的旧详情按段落对照；有标题则保留整个步骤为一组。
    if (!title && !line.trim()) { flush(); continue }
    lines.push(line)
  }
  flush()
  return groups
}

function inline(host, text) {
  for (const part of splitInline(text)) {
    host.append(part.code || part.strong ? make(part.code ? 'code' : 'strong', '', part.text) : document.createTextNode(part.text))
  }
}

function prose(host, text) {
  let fence = null, code = [], list = null
  const flushCode = () => { host.append(make('pre', 'detail-example', code.join('\n'))); code = [] }
  for (const line of text.split('\n')) {
    const mark = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    if (fence) {
      if (mark && mark[0] === fence[0] && mark.length >= fence.length && !line.trim().slice(mark.length).trim()) { fence = null; flushCode() }
      else code.push(line)
      continue
    }
    if (mark) { fence = mark; list = null; continue }
    if (!line.trim()) { list = null; continue }
    const bullet = /^\s*(?:[-*+]|\d+\.)\s+(.*)$/.exec(line)
    const heading = /^#{3,6}\s+(.*)$/.exec(line)
    const node = make(bullet ? 'li' : heading ? 'h4' : 'p')
    inline(node, bullet?.[1] || heading?.[1] || line)
    if (bullet) {
      if (!list) { list = make('ul'); host.append(list) }
      list.append(node)
    } else { list = null; host.append(node) }
  }
  if (fence) flushCode()
}

export async function loadDetailEvidence(version, request) {
  if (version.evidenceError) return { refs: [], message: `证据文件读不开：${version.evidenceError}` }
  if (version.files.evidence === null) return { refs: [], message: '这个版本没有证据文件。' }
  try {
    const data = await request(version.files.evidence)
    return { refs: data.refs || [], message: data.parseError ? `证据文件有问题：${data.parseError}` : data.missing ? '这个版本没有证据文件。' : '' }
  } catch (error) { return { refs: [], message: `证据读取失败：${error.message}` } }
}

export function renderNodeDetail(host, version, details, selection, evidence) {
  host.replaceChildren()
  const found = findSection(details, selection.id, { unreadable: version.detailsError })
  host.append(make('h2', 'reader-title', selection.label), make('p', 'detail-source', `${selection.id} · ${version.kind === 'snapshot' ? version.label || version.tag : '当前工作区'}`))
  if (found.kind !== 'section') {
    const reason = found.kind === 'unreadable' ? `说明文档读不开：${found.reason}`
      : found.kind === 'malformed' ? '说明文档没有按“## 节点编号”分节，暂时无法定位此节点。'
      : found.kind === 'empty' ? '这个版本没有说明文档。' : '这个节点还没有说明。'
    host.append(make('p', 'detail-miss', reason))
    return
  }
  if (found.repeats > 1) host.append(make('p', 'details-warn', `此编号有 ${found.repeats} 节说明，当前显示第一份。`))
  if (found.block.note) host.append(make('p', 'muted', found.block.note))
  const labels = make('div', 'reader-columns')
  labels.append(make('span', '', '源码依据'), make('span', '', '业务说明'))
  host.append(labels)
  const groups = detailGroups(found.block.body)
  if (!groups.length) host.append(make('p', 'detail-miss', '这一节还没有正文。'))
  for (const group of groups) {
    const row = make('section', 'reader-pair')
    const left = make('div', 'reader-code')
    const link = make('span', 'reader-link')
    link.setAttribute('aria-hidden', 'true')
    const right = make('div', 'reader-prose')
    if (group.title) right.append(make('h3', '', group.title))
    prose(right, group.body)
    if (!group.ids.length) {
      left.append(make('p', 'muted', '此段未关联源码证据'))
      row.classList.add('reader-unpaired')
    } else if (evidence.loading || evidence.message) {
      left.append(make('p', 'ev-warn', evidence.loading ? '正在读取源码证据…' : evidence.message))
    } else {
      for (const id of group.ids) {
        const refs = evidence.refs.filter(ref => ref.id === id)
        if (refs.length !== 1) {
          left.append(make('p', 'ev-bad', refs.length ? `证据编号重复：${id}，无法确定对应源码。` : `找不到引用：${id}`))
          continue
        }
        const ref = refs[0]
        const box = make('figure', 'reader-snippet')
        box.append(make('figcaption', '', ref.label || id))
        if (!ref.ok) box.append(make('p', 'ev-bad', displayError(ref.error)))
        else {
          const source = make('p', 'ev-src', describeSource(ref))
          source.title = `完整提交：${ref.commit}`
          const code = make('pre', 'ev-code', formatCodeBlock(ref.text, ref.fromLine))
          code.tabIndex = 0
          code.setAttribute('aria-label', `源码 ${ref.path}`)
          box.append(source, code)
        }
        left.append(box)
      }
    }
    row.append(left, link, right)
    host.append(row)
  }
  host.append(make('p', 'detail-source', '仅按文案中明确注明的证据编号配对；未关联资料可从“全部阅读资料”查看。源码取自引用写定的提交。'))
}
