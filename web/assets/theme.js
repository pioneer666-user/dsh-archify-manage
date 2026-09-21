// 在样式加载前恢复主题，避免刷新时闪烁；存储不可用时仍可在本页切换。
// 沿用图渲染器的主题偏好键，让新打开的图与管理页面使用同一偏好。
;(() => {
  const key = 'archify-theme'
  const valid = (value) => value === 'light' || value === 'dark'
  let initial
  try { initial = localStorage.getItem(key) } catch { /* 浏览器禁止存储时使用系统偏好。 */ }
  if (!valid(initial)) initial = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'

  function apply(theme) {
    document.documentElement.dataset.theme = theme
    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme))
    })
  }
  apply(initial)
  document.addEventListener('DOMContentLoaded', () => {
    apply(document.documentElement.dataset.theme)
    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
      button.addEventListener('click', () => {
        apply(button.dataset.themeChoice)
        try { localStorage.setItem(key, button.dataset.themeChoice) } catch { /* 本页切换不依赖存储。 */ }
      })
    })
  })
  window.addEventListener('storage', (event) => {
    if (event.key === key && valid(event.newValue)) apply(event.newValue)
  })
})()
