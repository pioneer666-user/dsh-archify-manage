// 业务页：业务介绍、文档入口、图列表（每图带快照数与当前状态）。
import { $, el, fetchJson, renderGuide, setStatus, showError, statusBadge } from './common.js'

function businessIdFromLocation() {
  const parts = location.pathname.split('/').filter(Boolean) // ['archify-manage','business','<id>']
  return parts[2] || ''
}

async function main() {
  const id = businessIdFromLocation()
  if (!id) return showError('缺少业务 id（路径应为 /archify-manage/business/<业务id>）')
  let inventory
  try {
    inventory = await fetchJson('/archify-manage/api/inventory')
  } catch (error) {
    return showError(error.message)
  }
  if (inventory.code === 'repo-not-configured') return renderGuide(inventory)

  const business = inventory.businesses.find((b) => b.id === id)
  if (!business) return showError(`业务不存在：${id}`)
  document.title = `${business.name} · 流程图管理`
  $('bizName').textContent = business.name
  $('title').textContent = business.name
  if (business.descriptorError) {
    $('intro').textContent = business.descriptorError
    setStatus('该业务的说明文件有问题，已被跳过展开', 'warn')
    return
  }
  if (business.intro) $('intro').textContent = business.intro

  if (business.docs.length > 0) {
    const list = $('docList')
    for (const doc of business.docs) {
      const li = el('li')
      const a = el('a')
      a.href = `/archify-manage/api/doc?business=${encodeURIComponent(id)}&path=${encodeURIComponent(doc)}`
      a.target = '_blank'
      a.rel = 'noopener'
      a.textContent = doc
      li.appendChild(a)
      list.appendChild(li)
    }
    $('docs').hidden = false
  }

  const root = $('root')
  root.textContent = ''
  for (const chart of business.charts) {
    const card = el('a', 'card')
    card.href = `/archify-manage/read/${id}/${chart.id}`
    const h = el('h2')
    h.textContent = chart.name
    h.insertAdjacentHTML('beforeend', statusBadge(chart.currentStatus, chart.compareError))
    card.appendChild(h)
    if (chart.idConflict) {
      const badge = el('span', 'badge')
      badge.dataset.kind = 'invalid'
      badge.textContent = '编号冲突'
      card.appendChild(badge)
      const p = el('p')
      p.textContent = chart.idConflict
      card.appendChild(p)
    } else if (chart.descriptorError) {
      const badge = el('span', 'badge')
      badge.dataset.kind = 'invalid'
      badge.textContent = '说明文件问题'
      card.appendChild(badge)
      const p = el('p')
      p.textContent = chart.descriptorError
      card.appendChild(p)
    } else if (chart.summary) {
      const p = el('p')
      p.textContent = chart.summary
      card.appendChild(p)
    }
    const meta = el('p', 'meta')
    const invalidNote = chart.invalidTagCount > 0 ? `，另有 ${chart.invalidTagCount} 个不合约定的标签被忽略` : ''
    meta.textContent = chart.snapshotCount > 0
      ? `快照 ${chart.snapshotCount} 版${invalidNote}`
      : `还没有保存过快照${invalidNote}`
    card.appendChild(meta)
    root.appendChild(card)
  }
  setStatus(`${business.name}：${business.charts.length} 张图`, 'ok')
}

main()
