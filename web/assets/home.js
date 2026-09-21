// 首页只从现有清单汇总项目与业务，不推测代码活动或图与代码的同步情况。
import { $, businessCard, el, fetchJson, pageTitle, renderEmptyWorkspaceParam, renderGuide, renderRepoLine, renderRepoState, setStatus, showError, workspaceParamEmpty, wsUrl } from './common.js'

async function main() {
  const root = $('root')
  try {
    if (workspaceParamEmpty) return renderEmptyWorkspaceParam()
    const inventory = await fetchJson(wsUrl('/archify-manage/api/inventory'))
    if (inventory.code === 'repo-not-configured') return renderGuide(inventory)

    document.title = pageTitle(inventory.project.name, inventory.repo)
    $('projectName').textContent = inventory.project.name
    $('projectDesc').textContent = inventory.project.description || '从业务出发，阅读流程、理解实现，回看每一个版本。'
    renderRepoLine(inventory.repo)

    const businesses = inventory.businesses
    const chartCount = businesses.reduce((count, business) => count + business.charts.length, 0)
    $('businessCount').textContent = businesses.length
    $('chartCount').textContent = chartCount
    $('chartCountNote').textContent = businesses.some((business) => business.descriptorError) ? '张图（不含读取异常的业务）' : '张登记的图'
    $('projectMetrics').hidden = false
    $('heroActions').hidden = businesses.length === 0
    $('showcaseLink').hidden = businesses.length === 0
    root.replaceChildren()

    for (const [index, business] of businesses.entries()) {
      root.append(businessCard(business, index))
    }
    if (businesses.length === 0) {
      const empty = el('div', 'empty-state')
      const h = el('h3')
      h.textContent = '项目已就绪，等待第一项业务'
      const p = el('p')
      p.textContent = '当前项目清单中还没有业务。添加业务资料后，刷新即可在这里查看。'
      empty.append(h, p)
      root.append(empty)
    }
    setStatus(`共 ${businesses.length} 个业务`, 'ok')
  } catch (error) {
    if (error.repo) renderRepoLine(error.repo)
    if (!renderRepoState(error)) showError(error.message)
  } finally {
    root.querySelector('.loading-copy')?.remove()
    root.setAttribute('aria-busy', 'false')
  }
}

main()
