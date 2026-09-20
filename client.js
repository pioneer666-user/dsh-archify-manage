// 客户端半边：DSH Web 侧栏里的"流程图管理"按钮（第二期第 4 步·落点 B）。
// 点按钮就地展开工作区清单（GET /archify-manage/api/workspaces），点某个工作区在
// 新标签打开 /archify-manage/?workspace=<id>；本页与当前会话原地不动。
// 新标签用 <a target="_blank"> 而不是 window.open：点击手势内直达，不受弹窗拦截影响；
// 认证靠 DSH 首次访问时换到的同源 cookie，新标签不需要再带 token。
// 纯 JS（无构建）；装载方式承自旧插件的 dsh.client 声明（package.json）。
window.__ModuleLoader__.load({
  id: '@specdev/dsh-archify-manage/client',
  factory(require) {
    const React = require('react')
    const { useEffect, useRef, useState } = React

    // 菜单从按钮上方弹出：footer 在侧栏底部，向下会被视口裁掉。
    // footer 链路（footArea/footerActions）没有 overflow:hidden，向上弹出不会被宿主裁剪。
    // 工作区多或窗口矮时向上也可能顶出视口（按钮在底部，上方约一个视口高）：
    // 限高到视口一半并在菜单内滚动，保证清单永远够得着。
    const MENU_STYLE = {
      position: 'absolute',
      bottom: '100%',
      left: '0',
      zIndex: 1000,
      minWidth: '240px',
      maxWidth: '380px',
      maxHeight: '50vh',
      overflowY: 'auto',
      margin: '0 0 6px',
      padding: '6px',
      borderRadius: '8px',
      border: '1px solid rgba(128,128,128,.4)',
      boxShadow: '0 4px 16px rgba(0,0,0,.25)',
    }
    const ITEM_STYLE = {
      display: 'block',
      width: '100%',
      padding: '6px 8px',
      border: 'none',
      borderRadius: '6px',
      background: 'transparent',
      color: 'inherit',
      textAlign: 'left',
      cursor: 'pointer',
      textDecoration: 'none',
    }
    const PATH_STYLE = {
      display: 'block',
      fontSize: '12px',
      opacity: 0.65,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }

    function ManageEntry() {
      const [open, setOpen] = useState(false)
      const [state, setState] = useState({ phase: 'idle' }) // idle | loading | ready | error
      const rootRef = useRef(null)

      // 每次打开都重新取清单：用户在 DSH 里新建/删除工作区后不用刷新页面。
      async function toggle() {
        if (open) {
          setOpen(false)
          return
        }
        setOpen(true)
        setState({ phase: 'loading' })
        try {
          const res = await fetch('/archify-manage/api/workspaces')
          const body = await res.json()
          if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
          setState({ phase: 'ready', workspaces: body.workspaces })
        } catch (error) {
          setState({ phase: 'error', message: String(error?.message ?? error) })
        }
      }

      // 点到菜单外就收起（菜单内含按钮自身，点按钮走上面的开合逻辑）。
      useEffect(() => {
        if (!open) return
        function onDocClick(event) {
          if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
        }
        document.addEventListener('click', onDocClick)
        return () => document.removeEventListener('click', onDocClick)
      }, [open])

      let menu = null
      if (open) {
        if (state.phase === 'loading') {
          menu = React.createElement('div', { style: { padding: '6px 8px' } }, '正在读取工作区…')
        } else if (state.phase === 'error') {
          menu = [
            React.createElement('div', { key: 'msg', role: 'alert', style: { padding: '6px 8px' } }, state.message),
            React.createElement(
              'a',
              { key: 'fallback', href: '/archify-manage/', target: '_blank', rel: 'noopener', style: ITEM_STYLE },
              '直接打开管理页 ↗',
            ),
          ]
        } else if (state.phase === 'ready') {
          menu = state.workspaces.length === 0
            ? [
              React.createElement(
                'div',
                { key: 'empty', style: { padding: '6px 8px' } },
                '还没有工作区：先在 DSH 里新建工作区，再回到这里进入。',
              ),
              // 手动配置了 repoRoot 的老用户（无工作区）仍要能从按钮进管理页。
              React.createElement(
                'a',
                { key: 'fallback', href: '/archify-manage/', target: '_blank', rel: 'noopener', style: ITEM_STYLE },
                '直接打开管理页 ↗',
              ),
            ]
            : state.workspaces.map((workspace) =>
              React.createElement(
                'a',
                {
                  key: workspace.id,
                  href: '/archify-manage/?workspace=' + encodeURIComponent(workspace.id),
                  target: '_blank',
                  rel: 'noopener',
                  style: ITEM_STYLE,
                  title: workspace.path || undefined,
                  onClick: () => setOpen(false),
                },
                React.createElement('span', null, workspace.title),
                workspace.path
                  ? React.createElement('span', { style: PATH_STYLE }, workspace.path)
                  : null,
              ))
        }
      }

      return React.createElement(
        'div',
        { ref: rootRef, style: { position: 'relative', width: '100%' } },
        React.createElement(
          'button',
          {
            type: 'button',
            title: '流程图管理',
            'aria-label': '流程图管理',
            'aria-expanded': open,
            onClick: toggle,
            style: { padding: '8px', width: '100%', cursor: 'pointer' },
          },
          '流程图管理 ↗',
        ),
        menu === null ? null : React.createElement('div', { style: MENU_STYLE }, menu),
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
