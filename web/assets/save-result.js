// 保存弹层的两条状态规则（纯逻辑：不碰 DOM、不发请求，可被 scripts/check-save.mjs 直接
// import 断言；页面里只剩"取数—渲染—发请求"的接线）。放这里的另一个原因：页面层没有
// 浏览器外的跑法，规则留在页面里就只能靠"源码里有没有这句话"来验，写在这里能真跑。
//
// ① 页面正展示的那份内容的摘要由本模块保管，只有"重新加载并展示了内容"才更新它。
//    保存成功后原地刷新版本条**不更新**——屏幕上还是原来那一份图与说明，过期检查就必须
//    仍按原来那一份算；否则后台在两次读取之间改了文件，页面会放行保存一份自己没展示过的内容。
// ② 一次保存请求的结果怎么算：ok 只认"状态成功 + 正文完整"，缺一不可——状态成功但正文
//    读不出来时结果未知，不能当成功，更不能去读一个可能为空的正文。

/** 页面正展示内容的摘要（v 不是 current、或摘要取不出来时为 null）。 */
let shown = null

/** 内容真正被加载并展示时调用（main 里一次）。刷新版本条不走这里。 */
export function rememberShown(data) {
  shown = data && typeof data.currentFingerprint === 'string' ? data.currentFingerprint : null
}

/** 页面正展示内容的摘要（保存自查与提交时送回服务端用）。 */
export function shownFingerprint() {
  return shown
}

/**
 * 弹层打开时的自查：把"这次读到的已提交内容"与"页面正展示的那一份"对一下。
 * check 是 GET /api/snapshots 的结果；请求没回来时传 { failed: 原因 }。
 * 返回 state：check-failed / no-repo / uncommitted / unknown / stale / ok（只有 ok 放行）。
 */
export function saveGate(shownPrint, check) {
  if (check && typeof check.failed === 'string') {
    return { state: 'check-failed', text: `没能检查这一版能不能存：${check.failed}` }
  }
  if (check && check.code === 'repo-not-configured') {
    return { state: 'no-repo', text: check.error }
  }
  if (!check || check.ok !== true) {
    return {
      state: 'uncommitted',
      text: '请先提交，再保存版本：',
      problems: Array.isArray(check?.problems) ? check.problems : [],
    }
  }
  if (typeof shownPrint !== 'string' || !shownPrint) {
    return {
      state: 'unknown',
      text: '这一版的内容摘要取不出来（有文件读不开），没法确认页面是不是最新的：请刷新页面后再保存。',
    }
  }
  if (check.fingerprint !== shownPrint) {
    return {
      state: 'stale',
      text: '内容已更新，请刷新后确认：页面上看到的这一版，和将要保存的内容已经不是同一份了。',
    }
  }
  return { state: 'ok', text: `将保存为提交 ${String(check.head).slice(0, 8)} 的快照，内容与你正在看的一致。` }
}

/**
 * 一次保存请求的结果 → 页面该做什么。responded/ok/status/body 是这次 fetch 的实况。
 * 返回 kind：created / already / created-unverified / rejected / unknown。
 */
export function saveOutcome({ responded, ok, status, body }) {
  const snapshot = body && typeof body === 'object' ? body.snapshot : null
  const label = snapshot && snapshot.meta && typeof snapshot.meta.name === 'string' ? snapshot.meta.name : ''
  const reason = body && typeof body.error === 'string' ? body.error : ''
  if (!responded) {
    return {
      kind: 'unknown',
      text: '没能确认有没有保存成功：请求没有回应。请刷新页面看版本列表，确认这一版是否已经存上，再决定要不要重存。',
    }
  }
  if (!ok) {
    // 版本已经写上去了、只是没核完：这话不能说成"没能保存"（用户会以为没存上又存一遍）
    if (body && body.code === 'save-created-unverified') {
      return {
        kind: 'created-unverified',
        text: `${reason || '版本可能已经写上去了，但读回核对没做完。'} 先刷新版本条核对，不要急着重存。`,
      }
    }
    return { kind: 'rejected', text: `没能保存：${reason || `服务端返回 ${status}`}` }
  }
  if (!label) {
    return {
      kind: 'unknown',
      text: '没能确认有没有保存成功：服务端说成功了，但回来的内容不完整。请刷新页面看版本列表，确认这一版是否已经存上，再决定要不要重存。',
    }
  }
  return { kind: body.alreadySaved === true ? 'already' : 'created', label }
}
