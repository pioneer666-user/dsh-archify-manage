// 核心层错误：带稳定 code，接入层（src/dsh）按 code 映射 HTTP 状态。
// message 一律中文、写明差在哪——它们会直接出现在页面上。
export class CoreError extends Error {
  code: string
  httpStatus: number

  // 字段在构造函数体内赋值（不用 TS 参数属性）：core 全部保持"可擦除语法"，
  // 纯 Node 剥类型模式即可加载，scripts/smoke.mjs 不依赖 tsx（2026-09-15 评审 #5 迁库时修）。
  constructor(code: string, message: string, httpStatus: number = 500) {
    super(message)
    this.code = code
    this.httpStatus = httpStatus
    this.name = 'CoreError'
  }
}

// 常用 code → 状态的约定（接入层直接用 httpStatus 字段，这里只列含义）：
//   no-convention-root   未找到约定根（404）
//   file-too-large       单文件超过读取上限（413）
//   git-timeout          git 调用超时（504）
//   git-failed           git 调用失败（500，message 带原始 stderr 首行）
//   git-unavailable      git 可执行文件不存在/无法启动（500，评审 #3）
//   fs-failed            工作区文件访问失败且非"确认不存在"（500，评审 #3）
//   bad-request          参数不合法（400）
//   not-found            找不到业务/图/标签/文件（404）
//   uncommitted-changes  图还有未提交的修改，或仓库还没有任何提交——没有可保存的内容（409，保存功能）
//   content-updated      内容已更新（后台新提交/页面是旧的），要求刷新后确认（409，保存功能）
