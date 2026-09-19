// 三个页面共用的小工具：取数、错误与"repoRoot 未配置"指引渲染。
export const $ = (id) => document.getElementById(id)

export function setStatus(text, kind = 'info') {
  const n = $('status')
  if (!n) return
  n.textContent = text
  n.dataset.kind = kind
}

export function showError(message) {
  setStatus('读取失败', 'bad')
  const box = $('errorBox')
  box.hidden = false
  box.textContent = message
}

/** 统一取数：非 2xx 时抛出后端给出的中文错误；repo 未配置交给调用方渲染指引。 */
export async function fetchJson(url) {
  let body
  try {
    const response = await fetch(url)
    body = await response.json()
    if (response.status === 400 && body.code === 'repo-not-configured') return body
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
    return body
  } catch (error) {
    if (body && body.code === 'repo-not-configured') return body
    throw new Error(error.message || String(error))
  }
}

/** 带正文发 POST 取 JSON（证据清单走这里）：把第一次响应里的清单原文原样交给服务端解析。 */
export async function postJson(url, text) {
  let body
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: text,
    })
    body = await response.json()
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
    return body
  } catch (error) {
    throw new Error(error.message || String(error))
  }
}

/** 渲染"repoRoot 未配置"指引（作者裁决：插件正常加载、页面给可复制的配置示例）。 */
export function renderGuide(payload) {
  setStatus('尚未配置业务项目目录', 'warn')
  const box = $('guideBox')
  box.hidden = false
  box.textContent = ''
  const h = document.createElement('h2')
  h.textContent = '还没有指定业务项目目录（repoRoot）'
  box.appendChild(h)
  const p = document.createElement('p')
  p.textContent = payload.error
  box.appendChild(p)
  const where = document.createElement('p')
  where.innerHTML = `<b>配置文件位置：</b>`
  where.appendChild(document.createTextNode(payload.guide.where))
  box.appendChild(where)
  const pre = document.createElement('pre')
  pre.textContent = payload.guide.example
  box.appendChild(pre)
  const effect = document.createElement('p')
  effect.textContent = payload.guide.takesEffect
  box.appendChild(effect)
}

export function el(tag, className) {
  const n = document.createElement(tag)
  if (className) n.className = className
  return n
}

/** 当前状态徽标文案（§3.2：一致 / 已改动 / 无快照 / 无法比较，服务端算好传下来）。 */
export function statusBadge(status, title) {
  const text = status === 'identical' ? '一致' : status === 'changed' ? '已改动'
    : status === 'compare-failed' ? '无法比较' : '无快照'
  const titleAttr = title ? ` title="${String(title).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}"` : ''
  return `<span class="badge" data-kind="${status}"${titleAttr}>${text}</span>`
}
