// 客户端半边：DSH Web 侧栏里的"流程图管理"按钮，进入 /archify-manage/ 阅读页。
// 纯 JS（无构建）；装载方式承自旧插件的 dsh.client 声明（package.json）。
window.__ModuleLoader__.load({
  id: '@specdev/dsh-archify-manage/client',
  factory(require) {
    const React = require('react')
    function ManageEntry() {
      return React.createElement(
        'button',
        {
          type: 'button',
          title: '流程图管理',
          'aria-label': '流程图管理',
          onClick: () => { window.location.assign('/archify-manage/') },
          style: { padding: '8px', width: '100%', cursor: 'pointer' },
        },
        '流程图管理 ↗',
      )
    }
    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register({ name: 'sidebar.footer.action', id: 'archify-manage', order: 100 }, ManageEntry))
      },
    }
  },
})
