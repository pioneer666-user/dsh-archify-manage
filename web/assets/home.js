// 项目首页：项目名 + 业务列表（清单完全来自约定树）。
import { $, el, fetchJson, renderGuide, setStatus, showError, statusBadge } from './common.js'

async function main() {
  let inventory
  try {
    inventory = await fetchJson('/archify-manage/api/inventory')
  } catch (error) {
    return showError(error.message)
  }
  if (inventory.code === 'repo-not-configured') return renderGuide(inventory)

  document.title = `${inventory.project.name} · 流程图管理`
  $('projectName').textContent = inventory.project.name
  if (inventory.project.description) $('projectDesc').textContent = inventory.project.description

  const root = $('root')
  root.textContent = ''
  for (const business of inventory.businesses) {
    const card = el('a', 'card')
    card.href = `/archify-manage/business/${business.id}`
    const h = el('h2')
    h.textContent = business.name
    card.appendChild(h)
    if (business.intro) {
      const p = el('p')
      p.textContent = business.intro
      card.appendChild(p)
    }
    const meta = el('p', 'meta')
    if (business.descriptorError) {
      card.appendChild(makeBadge('说明文件问题：' + business.descriptorError))
      meta.textContent = '该业务被跳过展开（不影响其余业务）'
    } else {
      meta.textContent = `${business.charts.length} 张图`
    }
    card.appendChild(meta)
    root.appendChild(card)
  }
  setStatus(`共 ${inventory.businesses.length} 个业务`, 'ok')
}

function makeBadge(text) {
  const span = el('span', 'badge')
  span.dataset.kind = 'invalid'
  span.textContent = text
  return span
}

main()
