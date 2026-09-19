// 说明文件（project.json / business.json / chart.json）的读取与字段校验。
// 只依赖 git.ts 的文件读取，无内部环。
import { readWorktreeFileOptional } from './git.ts'

/** 读一个说明文件；返回解析结果或带人话原因的错误（不抛）。 */
export async function readDescriptor<T>(
  repoRoot: string,
  relPath: string,
): Promise<{ data: T | null; error?: string }> {
  const text = await readWorktreeFileOptional(repoRoot, relPath)
  if (text === null) return { data: null, error: `缺少说明文件 ${relPath}` }
  try {
    return { data: JSON.parse(text) as T }
  } catch (error) {
    return { data: null, error: `${relPath} 不是合法 JSON：${(error as Error).message}` }
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 逐字段要求非空字符串；全部通过返回 null，否则返回一句人话原因。 */
export function requireStringFields(record: Record<string, unknown>, fields: readonly string[]): string | null {
  for (const field of fields) {
    const value = record[field]
    if (typeof value !== 'string' || !value.trim()) return `${field} 缺失或不是非空字符串`
  }
  return null
}
