// 管理逻辑公共出口。本目录是纯 Node 模块，不 import 任何 DSH 模块（D1 三块结构的第一块）。
export { CoreError } from './errors.ts'
export { runGit, assertRepoUsable, assertRepoTopLevel, gitShowFileOptional, readWorktreeFileOptional, resolveCommit, worktreeDirExists, worktreeFileExists, GIT_TIMEOUT_MS, MAX_FILE_BYTES } from './git.ts'
export { listArchifyTags, snapshotsForChart, findSnapshot, parseTagName, type RawTagRecord } from './snapshots.ts'
export { loadEvidence, resolveEvidenceRefs, splitLines } from './evidence.ts'
export { readInventory } from './inventory.ts'
export { readDescriptor, isPlainObject, requireStringFields } from './descriptor.ts'
export { readChartPage, compareCurrentWithLatest, locateChartDir, CHART_FILE_NAMES } from './chart.ts'
export { checkChartCommitted, saveChartSnapshot, createdUnverifiedError } from './save.ts'
export { CONVENTION_ROOT, SCHEMA } from './types.ts'
export type {
  ProjectInfo, BusinessInfo, ChartInfo, SnapshotEntry, SnapshotMeta, SnapshotStage,
  ChartSnapshots, ChartCurrentStatus, ChartSummary, BusinessSummary, Inventory,
  ChartFiles, ChartPageData, EvidenceRefResult, EvidenceResult,
  SaveCheck, SaveChartInput, SaveChartResult,
} from './types.ts'
