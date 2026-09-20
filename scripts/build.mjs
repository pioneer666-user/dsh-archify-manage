// 构建脚本：esbuild 把 src/dsh/index.ts（连带 src/core）打成 dist/index.js（ESM，node 平台）。
// 发布流程：tsc --noEmit（类型检查）→ 本脚本 → npm pack。esbuild 不做类型检查。
import { build } from 'esbuild'
import { rmSync, mkdirSync } from 'node:fs'

rmSync('dist', { recursive: true, force: true })
mkdirSync('dist', { recursive: true })
await build({
  entryPoints: ['src/dsh/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outfile: 'dist/index.js',
  banner: {
    js: '// 构建产物：由 scripts/build.mjs 从 src/ 生成，请勿手改。\n',
  },
  logLevel: 'info',
})
console.log('已生成 dist/index.js')
