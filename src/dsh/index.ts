// DSH 接入层（D1 三块结构的第二块）：把 src/core 的管理逻辑挂到 DSH 的 webServer 上。
// 只依赖注入的 ctx.webServer 服务，不 import 其他 DSH 内部模块。
// 装载双路径：开发态 --patch 直指本 .ts（tsx，探针已验证）；正式包指构建产物 dist/index.js。
import { existsSync, readFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CoreError,
  MAX_FILE_BYTES,
  readInventory,
  readChartPage,
  readWorktreeFileOptional,
  loadEvidence,
  checkChartCommitted,
  saveChartSnapshot,
} from '../core/index.ts'

export const name = 'specdev-archify-manage'
// skills＝DSH 技能注册表（dsh-skill）、fs＝文件后端（dsh-fs-sandbox，读不受沙箱限制），
// 都是 dsh 基座必挂服务，与 webServer 同源，按必填注入——装载时即保证自查可用。
// 若未来出现"有 webServer 无这两项"的组合，装载会等不到服务——那是部署面变化，届时再议。
export const inject = ['webServer', 'skills', 'fs']

interface ManageConfig {
  repoRoot?: string
}

/** 从当前文件向上找最近的 package.json 所在目录：开发态=archify-manager/，安装态=包根。 */
function findPackageRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  while (true) {
    if (existsSync(path.join(dir, 'package.json'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error('找不到包根（package.json）')
    dir = parent
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
}

function sendJson(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text),
  })
  res.end(text)
}

function sendError(res: import('node:http').ServerResponse, error: unknown): void {
  if (error instanceof CoreError) {
    sendJson(res, error.httpStatus, { code: error.code, error: error.message })
    return
  }
  sendJson(res, 500, { code: 'internal', error: error instanceof Error ? error.message : String(error) })
}

/** POST 正文最长接收时间：拖住不发完的连接到点回 408 并断开，不留挂起连接。 */
const BODY_TIMEOUT_MS = 10_000

/**
 * 收 POST 正文为文本。按实际收到的字节数查上限（与文件读取同一个 MAX_FILE_BYTES）：
 * 超限或超时只回复一次，响应写完就断开未完成的上传；写不完时最多再等一秒。
 * 正常收完返回正文；拒收或客户端断开返回 null，调用方不再答复。
 */
async function readRequestText(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
): Promise<string | null> {
  return await new Promise((resolve) => {
    const chunks: Buffer[] = []
    let received = 0
    let settled = false
    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      chunks.length = 0
      req.off('data', onData)
      req.off('end', onEnd)
      req.off('aborted', onAborted)
      res.off('close', onResponseClose)
      resolve(value)
    }

    const rejectBody = (error: CoreError) => {
      if (settled) return
      // 先结算并取消正文定时器，413 之后不再有机会发送 408。
      finish(null)
      req.pause()
      const disconnect = () => {
        clearTimeout(closeTimer)
        res.off('finish', disconnect)
        res.off('close', disconnect)
        req.destroy()
      }
      const closeTimer = setTimeout(disconnect, 1_000)
      closeTimer.unref?.()
      // 先注册再发送，既尽量送达错误响应，也不无限等待对方接收。
      res.once('finish', disconnect)
      res.once('close', disconnect)
      if (!res.headersSent && !res.destroyed) {
        res.setHeader('Connection', 'close')
        sendError(res, error)
      } else {
        disconnect()
      }
    }
    const onData = (chunk: Buffer) => {
      received += chunk.length
      if (received > MAX_FILE_BYTES) {
        rejectBody(new CoreError('request-too-large', `请求正文超过读取上限 ${MAX_FILE_BYTES} 字节，已停止接收`, 413))
        return
      }
      chunks.push(chunk)
    }
    const onEnd = () => finish(Buffer.concat(chunks).toString('utf8'))
    const onAborted = () => finish(null)
    const onError = () => finish(null)
    const onResponseClose = () => {
      finish(null)
      if (!req.complete) req.destroy()
    }
    const onRequestClose = () => {
      finish(null)
      // destroy/aborted 后仍可能发出 error，保留处理器到 close 再清理。
      req.off('error', onError)
    }
    const timer = setTimeout(() => rejectBody(new CoreError(
      'request-timeout', `请求正文超过 ${BODY_TIMEOUT_MS / 1000} 秒没有收完，已断开`, 408,
    )), BODY_TIMEOUT_MS)
    timer.unref?.()
    req.on('data', onData)
    req.once('end', onEnd)
    req.once('aborted', onAborted)
    req.on('error', onError)
    req.once('close', onRequestClose)
    res.once('close', onResponseClose)
  })
}

/** repoRoot 未配置时的统一响应：插件正常加载，页面据此渲染可复制的配置指引。 */
function repoNotConfigured(res: import('node:http').ServerResponse): void {
  sendJson(res, 400, {
    code: 'repo-not-configured',
    error: '尚未配置业务项目目录（repoRoot）。插件本身已正常加载；请按下面的示例在 profile 配置里指定后重启 DSH。',
    guide: {
      where: '$DSH_HOME/profiles/<profile名>/cordis.patch.yml（profile 自己的配置层，按 id 覆盖本插件的行）',
      // 勿写 - insert：insert 是新增条目，会与本包自带条目撞 id（duplicate loader entry）启动失败；
      // 同 id 不带 insert 才是覆盖。实测见 DEVELOPING.md 坑4 与安装闭环验收回执。
      example: [
        "- id: specdev-archify-manage",
        "  config:",
        "    repoRoot: 'D:/你的/业务项目仓库'",
      ].join('\n'),
      takesEffect: '保存配置后重启 DSH 生效（配置在启动时组合，改配置文件不会热生效）。',
    },
  })
}

/** 服务一个静态文件（限制在 base 目录内、带大小上限）；不存在返回 false 由调用方决定回退。 */
async function serveFile(
  res: import('node:http').ServerResponse,
  base: string,
  rel: string,
): Promise<boolean> {
  const parts = rel.split('/').filter((p) => p !== '' && p !== '.')
  if (parts.length === 0 || parts.some((p) => p === '..')) return false
  const full = path.resolve(base, ...parts)
  const root = path.resolve(base)
  if (!full.startsWith(root + path.sep)) return false
  let size: number
  try {
    size = (await stat(full)).size
  } catch {
    return false
  }
  if (size > MAX_FILE_BYTES) {
    sendError(res, new CoreError('file-too-large', `静态资源 ${rel} 为 ${size} 字节，超过读取上限 ${MAX_FILE_BYTES} 字节`, 413))
    return true
  }
  const body = await readFile(full)
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(full).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Content-Length': body.length,
  })
  res.end(body)
  return true
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

function requireId(res: import('node:http').ServerResponse, value: string | null, what: string): string | null {
  if (value === null || !ID_PATTERN.test(value)) {
    sendError(res, new CoreError('bad-request', `参数 ${what} 不合法：${value ?? '(缺失)'}`, 400))
    return null
  }
  return value
}

// ── 随包技能注册（1d 方案 A）──────────────────────────────────
// DSH 的技能扫描根不含插件安装目录（发行版 dsh-skill-filesystem roots()），
// 设计路径是 deployment 插件向注册表全局层注册（dsh-web-app 补丁注释）。
// 这里按 dsh-skill-badge 同款范式（inject skills + ctx.skills.register）接通。

/** dsh-skill 注册表的结构类型（只声明用到的方法；不 import DSH 内部模块，与本文件既有约定一致）。 */
interface SkillRegistryLike {
  register: (skill: {
    name: string
    description: string
    content: string
    source: string
    resourceBase?: { kind: 'directory'; path: string }
  }) => unknown
  list: (options?: Record<string, unknown>) => Promise<Array<{ name: string }>>
  get: (name: string, options?: Record<string, unknown>) => Promise<{ name: string; content: string } | undefined>
}

/** fs 后端的结构类型：模型读取工具背后的服务（fs 沙箱只圈写，读不受限）。readText 吃 resolve 的返回对象。 */
interface FsBackendLike {
  resolve: (path: string, options?: Record<string, unknown>) => Promise<{ targetKey: string; displayPath: string }>
  readText: (target: { targetKey: string; displayPath: string }, signal?: unknown) => Promise<string>
}

/**
 * 解析 SKILL.md：frontmatter 只取 name 与 description 两键，正文原样返回；不合式返回 null。
 * 换行按 LF 解析、容忍 CRLF；正文不做任何改写。
 */
export function parseSkillFrontmatter(raw: string): { name: string; description: string; content: string } | null {
  const text = raw.startsWith('﻿') ? raw.slice(1) : raw
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) return null
  const end = text.indexOf('\n---', 4)
  if (end < 0) return null
  let body = text.slice(end + 4)
  if (body.startsWith('\r')) body = body.slice(1)
  if (body.startsWith('\n')) body = body.slice(1)
  if (!body.trim()) return null
  let parsedName = ''
  let description = ''
  for (const line of text.slice(4, end).split('\n')) {
    // 捕获组排除行终结符（CRLF 行尾的 \r 不被 . 匹配），取值再 trim 掉两端空白。
    const matched = /^([A-Za-z][A-Za-z0-9_-]*):[ \t]?([^\r\n]*)/.exec(line)
    if (!matched) continue
    if (matched[1] === 'name') parsedName = matched[2].trim()
    else if (matched[1] === 'description') description = matched[2].trim()
  }
  if (!parsedName || !description) return null
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(parsedName)) return null
  return { name: parsedName, description, content: body }
}

/**
 * 注册后自查：走模型侧同款 ctx.skills.list()/get() 与 ctx.fs.readText()，
 * 就地取证"能发现、能加载正文、能读参考文件"；结果只落日志，不抛出。
 * get() 内部会跑 validateDefinition——漏 source 之类的注册缺陷在这里现形（评审第 1 条）。
 */
async function selfCheckSkill(
  ctx: { skills?: SkillRegistryLike; fs?: FsBackendLike },
  expected: { name: string; content: string },
  skillDir: string,
  log: (message: string) => void,
): Promise<void> {
  const registry = ctx.skills
  if (!registry) return
  const listed = (await registry.list()).some((skill) => skill.name === expected.name)
  const definition = await registry.get(expected.name)
  const sampleRel = 'references/specification.md'
  let sample: string | undefined
  let sampleWhy = ''
  if (ctx.fs === undefined) sampleWhy = 'ctx.fs 不可用'
  else {
    try {
      // 与模型读取工具同链路：先 resolve 成 target 对象，再 readText（直接传字符串会因缺 targetKey 报错）。
      const target = await ctx.fs.resolve(path.join(skillDir, sampleRel))
      sample = await ctx.fs.readText(target)
    } catch (error) {
      sampleWhy = String(error)
    }
  }
  const contentOk = definition !== undefined && definition.content === expected.content
  const sampleNote = sample === undefined ? `未通过（${sampleWhy}）` : `${sample.length} 字`
  log(
    `技能自查：list ${listed ? '已见' : '未见'} ${expected.name}；`
    + `get 正文 ${definition === undefined ? '未取到' : `${definition.content.length} 字${contentOk ? '（与 SKILL.md 一致）' : '（与 SKILL.md 不一致）'}`}；`
    + `fs 读 ${sampleRel} ${sampleNote}`,
  )
  if (!listed || !contentOk || sample === undefined) {
    log(`技能自查存在未过项（list=${listed} 正文=${contentOk} 参考文件=${sample !== undefined}）`)
  }
}

/**
 * 把随包技能注册进 DSH 技能注册表。成功返回 true；任何失败只记日志、不抛——
 * 注册是管理页之外的附加能力，不能拖垮主功能。resourceBase 只是指给模型的路径提示，
 * 参考文件由模型用自身读取工具按需读取（fs 沙箱不限制读）。
 */
export function registerBundledSkill(
  ctx: { skills?: SkillRegistryLike; fs?: FsBackendLike },
  skillDir: string,
  log: (message: string) => void,
): boolean {
  let raw: string
  try {
    raw = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')
  } catch (error) {
    log(`随包技能注册失败：读不到 ${path.join(skillDir, 'SKILL.md')}（${String(error)}）`)
    return false
  }
  const parsed = parseSkillFrontmatter(raw)
  if (!parsed) {
    log('随包技能注册失败：SKILL.md frontmatter 不合式（需 --- 包裹的 name 与 description，name 须小写中划线）')
    return false
  }
  if (!ctx.skills) {
    log(`随包技能注册跳过：ctx.skills 服务不可用（已解析 ${parsed.name}）`)
    return false
  }
  ctx.skills.register({
    name: parsed.name,
    description: parsed.description,
    content: parsed.content,
    // source 必填：register() 只代补 invocation/provider，加载侧 validateDefinition 校验 source 必须是字符串。
    source: 'runtime',
    resourceBase: { kind: 'directory', path: skillDir },
  })
  log(`技能 ${parsed.name} 已注册（source=runtime，resourceBase=${skillDir}）`)
  void selfCheckSkill(ctx, parsed, skillDir, log).catch((error) => {
    log(`技能自查失败：${String(error)}`)
  })
  return true
}

export function apply(
  ctx: {
    webServer: { register: (route: unknown) => () => void }
    effect: (disposer: () => void, label?: string) => unknown
    skills?: SkillRegistryLike
    fs?: FsBackendLike
  },
  config: ManageConfig,
): void {
  // 启动观测（验收后可降噪）：装载路径、repoRoot 是否进来了、路由是否注册成功。
  console.error(`[archify-manage] apply 运行：repoRoot=${JSON.stringify(config?.repoRoot ?? '(缺省)')}`)
  const repoRoot = typeof config?.repoRoot === 'string' ? config.repoRoot.trim() : ''
  const packageRoot = findPackageRoot()
  const webRoot = path.join(packageRoot, 'web')
  const vendorRoot = path.join(packageRoot, 'vendor', 'archify-renderer')

  // 路由前缀用 archify-manage（作者 2026-09-15 裁定：单用 archify 是别人的产物名，敏感）。
  const dispose = ctx.webServer.register({
    kind: 'prefix',
    path: '/archify-manage',
    async handler(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
      try {
        await handle(req, res, { repoRoot, webRoot, vendorRoot })
      } catch (error) {
        if (!res.headersSent) sendError(res, error)
        else res.end()
      }
    },
  })
  console.error('[archify-manage] /archify-manage 前缀路由已注册')
  // effect 的回调在加载时执行、其返回值才是卸载时的清理函数——返回 dispose 本身，不要当场调用。
  ctx.effect(() => dispose, '流程图管理路由清理')

  // 随包技能注册（1d 方案 A）：安装目录不在 DSH 技能扫描根里，靠运行时注册把 archify-maker
  // 挂进注册表全局层；注册后自查取证（发现／正文／参考文件），日志与上面两行同风格。
  const skillDir = path.join(packageRoot, 'skills', 'archify-maker')
  registerBundledSkill(ctx, skillDir, (message) => console.error(`[archify-manage] ${message}`))
}

interface RouteContext {
  repoRoot: string
  webRoot: string
  vendorRoot: string
}

async function handle(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  ctx: RouteContext,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const segments = url.pathname.split('/').filter((s) => s !== '') // ['archify-manage', ...]
  // 接口以只读为主（GET/HEAD）；只有两个 POST：
  //   /api/evidence —— 正文提交第一次响应（/api/chart）里的证据清单原文，消除"页面两次请求
  //     之间文件被保存，图与证据来自两个版本"的错配；只解析、不写任何文件。
  //   /api/snapshots —— 保存版本：本插件唯一的写操作，只给确认过的那次提交打一个附注标签，
  //     工作区文件、分支与提交一概不动。
  const apiPost =
    req.method === 'POST' && segments.length === 3 && segments[1] === 'api'
    && (segments[2] === 'evidence' || segments[2] === 'snapshots')
  if (req.method !== 'GET' && req.method !== 'HEAD' && !apiPost) {
    sendError(res, new CoreError('bad-request', '接口只读（GET/HEAD）；仅 POST /api/evidence 与 POST /api/snapshots 例外', 405))
    return
  }

  // 页面
  if (segments.length === 1) {
    if (await serveFile(res, ctx.webRoot, 'index.html')) return
  } else if (segments.length === 2 && segments[1] === 'business') {
    if (await serveFile(res, ctx.webRoot, 'business.html')) return
  } else if (segments.length === 3 && segments[1] === 'business' && ID_PATTERN.test(segments[2])) {
    if (await serveFile(res, ctx.webRoot, 'business.html')) return
  } else if (segments.length >= 3 && segments[1] === 'read') {
    if (await serveFile(res, ctx.webRoot, 'read.html')) return
  }

  // 静态资产：页面自身资源与 vendor 渲染器副本
  if (segments[1] === 'assets' && segments.length > 2) {
    if (await serveFile(res, path.join(ctx.webRoot, 'assets'), segments.slice(2).join('/'))) return
  }
  if (segments[1] === 'vendor' && segments.length > 2) {
    if (await serveFile(res, ctx.vendorRoot, segments.slice(2).join('/'))) return
  }

  // API（同源；GET/HEAD 只读，两个 POST 例外见上方 apiPost）
  if (segments[1] === 'api') {
    await handleApi(req, url, res, ctx)
    return
  }

  sendError(res, new CoreError('not-found', `路径不存在：${url.pathname}`, 404))
}

async function handleApi(
  req: import('node:http').IncomingMessage,
  url: URL,
  res: import('node:http').ServerResponse,
  ctx: RouteContext,
): Promise<void> {
  const api = url.pathname.split('/').filter((s) => s !== '')[2] // /archify-manage/api/<name>
  const q = url.searchParams

  if (api === 'inventory') {
    if (!ctx.repoRoot) return repoNotConfigured(res)
    sendJson(res, 200, await readInventory(ctx.repoRoot))
    return
  }

  if (api === 'chart') {
    if (!ctx.repoRoot) return repoNotConfigured(res)
    const business = requireId(res, q.get('business'), 'business')
    if (!business) return
    const chart = requireId(res, q.get('chart'), 'chart')
    if (!chart) return
    const v = q.get('v') || 'current'
    sendJson(res, 200, await readChartPage(ctx.repoRoot, business, chart, v))
    return
  }

  if (api === 'evidence') {
    if (!ctx.repoRoot) return repoNotConfigured(res)
    // POST：正文是第一次响应（/api/chart）里那份 evidence.json 的原文。只按提交来的正文
    // 解析与切片，不读磁盘上的当前文件——两次请求之间文件被保存也不会图与证据错配；
    // 缺失（第一次拿到 null）与读不开（evidenceError）由页面就地说明，本接口不存在回退路径。
    if (req.method === 'POST') {
      const text = await readRequestText(req, res)
      if (text === null) return // 正文超限/超时，已回过 413/408
      sendJson(res, 200, await loadEvidence(ctx.repoRoot, text))
      return
    }
    // GET：脚本与既有用法原样保留（自己重读所选版本的文件）
    const business = requireId(res, q.get('business'), 'business')
    if (!business) return
    const chart = requireId(res, q.get('chart'), 'chart')
    if (!chart) return
    const v = q.get('v') || 'current'
    const page = await readChartPage(ctx.repoRoot, business, chart, v)
    // evidence.json 本身读不开（如超过大小上限）：如实走文件级错误通道，不误报"没有证据文件"
    if (page.version.evidenceError) {
      sendJson(res, 200, { missing: false, parseError: page.version.evidenceError, refs: [] })
      return
    }
    const evidence = await loadEvidence(ctx.repoRoot, page.version.files.evidence)
    sendJson(res, 200, evidence)
    return
  }

  if (api === 'snapshots') {
    if (!ctx.repoRoot) return repoNotConfigured(res)
    if (req.method === 'POST') {
      // 保存：正文 {business, chart, name, stage, note?, head, fingerprint}。head 与 fingerprint
      // 是弹层打开时检查结果里带回来的——钉住用户确认过的那次提交与那份内容，防"看到的是新图、
      // 存下的是旧图"；正文形状由核心层校验（一律 400），这里只把解析后的正文原样转交。
      const text = await readRequestText(req, res)
      if (text === null) return // 正文超限/超时，已回过 413/408
      let body: unknown
      try {
        body = JSON.parse(text)
      } catch {
        sendError(res, new CoreError('bad-request', '保存请求正文必须是 JSON', 400))
        return
      }
      const fields = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
      const business = requireId(res, typeof fields.business === 'string' ? fields.business : null, 'business')
      if (!business) return
      const chart = requireId(res, typeof fields.chart === 'string' ? fields.chart : null, 'chart')
      if (!chart) return
      const result = await saveChartSnapshot(ctx.repoRoot, business, chart, body, {
        expectedHead: typeof fields.head === 'string' ? fields.head : '',
        fingerprint: typeof fields.fingerprint === 'string' ? fields.fingerprint : '',
      })
      sendJson(res, 200, result)
      return
    }
    // GET：保存前检查（head/ok/problems/fingerprint）。页面把服务端摘要与自己正展示内容的
    // 摘要一对就知道自己是不是旧的；POST 时服务端还会再核一次（双保险）。
    const business = requireId(res, q.get('business'), 'business')
    if (!business) return
    const chart = requireId(res, q.get('chart'), 'chart')
    if (!chart) return
    sendJson(res, 200, await checkChartCommitted(ctx.repoRoot, business, chart))
    return
  }

  if (api === 'doc') {
    if (!ctx.repoRoot) return repoNotConfigured(res)
    const business = requireId(res, q.get('business'), 'business')
    if (!business) return
    const docPath = q.get('path')
    if (!docPath) {
      sendError(res, new CoreError('bad-request', '缺少 path 参数', 400))
      return
    }
    // 只允许读该业务 business.json 里声明过的文档路径（防任意文件读取）。
    const inventory = await readInventory(ctx.repoRoot)
    const entry = inventory.businesses.find((b) => b.id === business)
    if (!entry || !entry.docs.includes(docPath)) {
      sendError(res, new CoreError('not-found', `文档未在业务 ${business} 的 docs 里声明：${docPath}`, 404))
      return
    }
    const text = await readWorktreeFileOptional(ctx.repoRoot, docPath)
    if (text === null) {
      sendError(res, new CoreError('not-found', `文档不存在（工作区）：${docPath}`, 404))
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(text)
    return
  }

  sendError(res, new CoreError('not-found', `接口不存在：${api ?? '(缺失)'}`, 404))
}
