// 图与外层的连接：观察原生选中标记，并集中适配节点双击详情。
// 不修改 vendor，不拦截单击、键盘与拖动。上游升级时复验此适配层。
//
// 页面切版本是整页跳转，图与观察随页面一起没了，所以阅读页不需要在页内清理；
// dispose() 留给"同一页里想换一张图"的将来用法。
//
// 选中含义沿用旧增强阅读器的规则：**恰好一个**节点带标记才算选中，多个按未选中处理
// （那种情形是"多点聚焦"，不是"选中了谁"）。

const SVG_SELECTOR = 'svg[role="img"]'
const MARKER = 'data-focus-selected'

/**
 * 从"带选中标记的节点"清单得出结论：恰好一个才算选中，多个按未选中处理。
 * 纯函数（只认 { id }），Node 里可直接测。
 */
export function selectedId(selected) {
  const ids = (selected || [])
    .map((node) => (node && typeof node.id === 'string' ? node.id : ''))
    .filter(Boolean)
  return ids.length === 1 ? ids[0] : null
}

/**
 * 从主图 SVG 里读一次当前选中：返回 { id, label } 或 null。
 * label 取图上那个节点自己的名字（data-node-label）；缺了就退回编号，不编造。
 * 只用到 querySelectorAll / getAttribute，Node 里给个同形替身即可测。
 */
export function readSelection(svg) {
  const selected = [...svg.querySelectorAll(`[${MARKER}]`)].map((node) => ({
    id: node.getAttribute('data-node-id'),
    label: node.getAttribute('data-node-label') || node.getAttribute('data-node-id'),
  }))
  const id = selectedId(selected)
  if (!id) return null
  const hit = selected.find((node) => node.id === id)
  return { id, label: hit.label }
}

/**
 * 进小房间取文档：装配前的空文档不算，等 load 落地后再交出来；被拦下走 onBlocked。
 * 失败有尽头，不留"永远等着"的口子（复审修复）：load 都到过了仍拿不到文档——
 * 不会再有下一个信号，到此为止明确报；一直等不到 load，超时也报。
 */
function whenLoaded(frame, onDoc, onBlocked, timeoutMs = 10000) {
  let settled = false
  let timer = null

  function finish(run) {
    if (settled) return
    settled = true
    if (timer) clearTimeout(timer)
    frame.removeEventListener('load', onLoad)
    run()
  }

  function docOf() {
    try {
      return { doc: frame.contentDocument }
    } catch (error) {
      return { blocked: `进不去图所在的小房间（${error.name || '跨源'}）` }
    }
  }

  function onLoad() {
    const got = docOf()
    if (got.blocked) return finish(() => onBlocked(got.blocked))
    const doc = got.doc
    if (!doc) return finish(() => onBlocked('图加载完了，页面却进不去它的内部文档'))
    if (doc.location && doc.location.href !== 'about:blank') return finish(() => onDoc(doc))
    // 这次 load 的是装配前的空文档：不算数，接着等真正那次
  }

  const initial = docOf()
  if (initial.blocked) {
    finish(() => onBlocked(initial.blocked))
    return () => {}
  }
  if (initial.doc && initial.doc.location && initial.doc.location.href !== 'about:blank') {
    finish(() => onDoc(initial.doc))
    return () => {}
  }
  // 还没加载出来或还在空文档：等真正那次 load；真等不来，到点按超时收尾
  frame.addEventListener('load', onLoad)
  timer = setTimeout(
    () => finish(() => onBlocked(`等图加载等得太久（超过 ${Math.max(1, Math.round(timeoutMs / 1000))} 秒）`)),
    timeoutMs,
  )
  return () => finish(() => {})
}

/**
 * 接上画布里的图：onSelection({ id, label } | null, ...) 每次结论变化报一次（含初读）；
 * 接不上（进不去小房间 / 图里找不到主图 / 等图加载等到超时）走 onUnavailable(原因)，只报一次。
 * timeoutMs 是等图加载的最长时间（毫秒，默认 10 秒），到点仍没等到就按接不上报。
 * 返回 { dispose() }，调用方不需要时可以不接（切版本整页重载）。
 */
export function connectChartSelection(frame, { onSelection, onUnavailable, onOpenDetail, timeoutMs } = {}) {
  let observer = null
  let removeDoubleClick = () => {}
  let stopWaiting = () => {}
  let cancelled = false
  let reported = false
  let seen = false
  let lastId = null

  const fail = (reason) => {
    if (cancelled || reported) return
    reported = true
    onUnavailable?.(reason)
  }

  const publish = (selection) => {
    if (cancelled) return
    const id = selection ? selection.id : null
    if (seen && id === lastId) return // 结论没变不重复打扰
    seen = true
    lastId = id
    onSelection?.(selection)
  }

  const start = (doc) => {
    let svg = null
    try {
      svg = doc.querySelector(SVG_SELECTOR)
    } catch (error) {
      fail(`图里的内容读不到（${error.name || '取不到' }）`)
      return
    }
    if (!svg) {
      fail('图里找不到主图')
      return
    }
    const sync = () => publish(readSelection(svg))
    // 双击适配集中于此；不修改上游，不拦截单击、拖动或空白区事件。
    const open = (event) => {
      if (cancelled || event.button !== 0) return
      const node = event.target.closest?.('[data-node-id]')
      if (!node || !svg.contains(node)) return
      const id = node.getAttribute('data-node-id')
      if (!id) return
      onOpenDetail?.({ id, label: node.getAttribute('data-node-label') || id }, node)
    }
    if (onOpenDetail) {
      svg.addEventListener('dblclick', open)
      removeDoubleClick = () => svg.removeEventListener('dblclick', open)
    }
    observer = new MutationObserver(sync)
    // 只看这一个标记：图内其它变化（缩放、悬停、播放）与选中无关，不惊动外层
    observer.observe(svg, { subtree: true, attributes: true, attributeFilter: [MARKER] })
    sync() // 初读一次：连接时图里可能已经有选中
  }

  stopWaiting = whenLoaded(frame, start, fail, timeoutMs)

  return {
    dispose() {
      cancelled = true
      observer?.disconnect()
      observer = null
      removeDoubleClick()
      stopWaiting()
    },
  }
}
