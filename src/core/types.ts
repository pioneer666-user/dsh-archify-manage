// 领域类型（第一批：目录与阅读）。字段与第一批实施设计（目录与阅读）§二一致。

/** 约定根（D2 裁定：第一版只认这一种组织方式）。 */
export const CONVENTION_ROOT = 'docs/archify'

/** 说明文件 schema 取值（首批均为 /1，统一 specdev-archify 前缀）。 */
export const SCHEMA = {
  project: 'specdev-archify/project/1',
  business: 'specdev-archify/business/1',
  chart: 'specdev-archify/chart/1',
  evidence: 'specdev-archify/evidence/1',
  snapshot: 'specdev-archify/snapshot/1',
} as const

export type SnapshotStage = 'design' | 'implemented'

export interface ProjectInfo {
  schema: string
  name: string
  description?: string
}

export interface BusinessInfo {
  schema: string
  id: string
  name: string
  intro?: string
  /** 业务文档的仓库相对路径数组；文档留在原位，只引用不复制。 */
  docs?: string[]
}

export interface ChartInfo {
  schema: string
  id: string
  name: string
  summary?: string
}

/** 校验通过的快照（附注标签剥壳后的登记记录）。 */
export interface SnapshotEntry {
  /** 标签全名，形如 archify/<图编号>/<版本标识>。 */
  tag: string
  /** 版本标识（标签名第三段起）。 */
  version: string
  /** 图稳定编号（= 标签名第二段 = 图目录名）。 */
  chart: string
  /** 标签剥壳后指向的提交号（40 位十六进制）。 */
  commit: string
  /** 标签创建时间（for-each-ref 的 iso8601-strict）。 */
  createdDate: string
  /** 标签 message 里的元数据（已通过 §2.4 五项校验）。 */
  meta: SnapshotMeta
}

export interface SnapshotMeta {
  schema: 'specdev-archify/snapshot/1'
  chart: string
  name: string
  stage: SnapshotStage
  note?: string
  dir: string
  savedAt?: string
}

/** 一张图的快照清单（无效标签跳过并计数，绝不当作快照）。 */
export interface ChartSnapshots {
  snapshots: SnapshotEntry[]
  invalidCount: number
  /** 无效标签名样本（最多 5 条），页面提示用。 */
  invalidSamples: string[]
}

/** 保存前检查结果（保存功能 (a)）：ok = 三个数据文件与最近一次提交逐文件一致（换行归一后比）。 */
export interface SaveCheck {
  /** HEAD 提交号；null = 仓库还没有任何提交。 */
  head: string | null
  ok: boolean
  /** ok=false 的原因（逐文件，直接上页面）。 */
  problems: string[]
  /** HEAD 上三个文件（换行归一后）的内容摘要；页面拿它核对"我正看的就是将要保存的"；读不开时为 null。 */
  fingerprint: string | null
}

/** 保存请求的登记信息（核心层校验后使用：名称必填 ≤200 字、阶段二选一、说明可选 ≤1000 字）。 */
export interface SaveChartInput {
  name: string
  stage: SnapshotStage
  note?: string
}

/** 保存结果：新存的快照，或重复识别命中的已有那份（alreadySaved=true，未新增标签）。 */
export interface SaveChartResult {
  snapshot: SnapshotEntry
  alreadySaved: boolean
}

/**
 * 'compare-failed'：工作区与最新快照的比较本身失败（如文件超过读取上限）——
 * 不是没有快照，也不是已改动；单独成态，逐图隔离，不拖累清单里其他图。
 */
export type ChartCurrentStatus = 'no-snapshot' | 'identical' | 'changed' | 'compare-failed'

export interface ChartSummary {
  id: string
  name: string
  summary?: string
  /** 说明文件缺失/不合法时的问题描述；存在则页面标记"说明文件缺失"并跳过展开。 */
  descriptorError?: string
  /** 图编号在多个业务下重复（评审 #1）：快照标签按编号归组、无法区分归属，该图阅读已停用。 */
  idConflict?: string
  /** 工作区是否有 workflow.json（没有则该图明确报错，不给空白页）。 */
  hasWorkflow: boolean
  snapshotCount: number
  invalidTagCount: number
  currentStatus: ChartCurrentStatus
  /** currentStatus='compare-failed' 时的原因（页面悬停可见）。 */
  compareError?: string
  latestSnapshot?: {
    tag: string
    name: string
    stage: SnapshotStage
    savedAt?: string
    createdDate: string
  }
}

export interface BusinessSummary {
  id: string
  name: string
  intro?: string
  docs: string[]
  descriptorError?: string
  charts: ChartSummary[]
}

export interface Inventory {
  project: ProjectInfo
  businesses: BusinessSummary[]
}

/** 图目录下的三个数据文件（缺哪个由调用方按 §3.5 降级）。 */
export interface ChartFiles {
  workflow: string | null
  details: string | null
  evidence: string | null
}

/** 阅读页一屏所需的全部数据（API /archify/api/chart 的返回体）。 */
export interface ChartPageData {
  business: { id: string; name: string }
  chart: { id: string; name: string; summary?: string }
  snapshots: ChartSnapshots
  /** 当前工作区与最新快照的比较结果（服务端算）。 */
  currentStatus: ChartCurrentStatus
  /** currentStatus='compare-failed' 时的原因（页面悬停可见）。 */
  compareError?: string
  /**
   * v=current 时本次读出来的工作区内容摘要（与保存检查同一个规则算）。
   * 保存弹层打开时拿它与检查结果里的摘要一比，就知道页面是不是已经旧了；
   * 快照版本、或任一文件读不开时为 null（没有可比对的一份内容，页面据此不给自查）。
   */
  currentFingerprint?: string | null
  version: {
    kind: 'current' | 'snapshot'
    /** kind=snapshot 时的标签名。 */
    tag?: string
    /** kind=snapshot 时标签指向的提交号。 */
    commit?: string
    /** 快照登记的显示名/阶段（来自标签元数据）。 */
    label?: string
    stage?: SnapshotStage
    /** 快照登记的保存说明与保存时间（§3.2 要求展示）。 */
    note?: string
    savedAt?: string
    files: ChartFiles
    /** workflow.json 不可读的明确错误（图不可读，不是空白页）；kind 区分"缺失"与"读不开"。 */
    workflowError?: string
    workflowErrorKind?: 'missing' | 'unreadable'
    /** details.md / evidence.json 读不开的原因（与"没有该文件"区分，页面如实说明）。 */
    detailsError?: string
    evidenceError?: string
  }
}

/** evidence.json 一条引用的解析结果：要么切片成功，要么明确报错。 */
export type EvidenceRefResult =
  | {
      ok: true
      id: string
      label: string
      repo: string
      commit: string
      path: string
      fromLine: number
      toLine: number
      lineCount: number
      text: string
    }
  | {
      ok: false
      id: string
      label: string
      error: string
    }

export interface EvidenceResult {
  /** evidence.json 文件本身缺失（→"尚未配置证据文件"）。 */
  missing: boolean
  /** 文件存在但不是合法 JSON / refs 不是数组（→整文件级错误）。 */
  parseError?: string
  refs: EvidenceRefResult[]
}
