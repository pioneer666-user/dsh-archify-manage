# @specdev/dsh-archify-manage · DSH 流程图管理插件

简体中文 ｜ [English](README.md)

DSH（DeepSeek Harness）插件：浏览用 Archify 生成的业务流程图目录，按 Git 附注标签阅读
历史版本，并把当前已提交的图内容登记成一个有名称的版本（保存版本）。唯一的写动作就是
给提交挂一个附注标签——**不改动业务项目的文件、分支与提交**。

> 这个插件来自我对 AI 开发流程的探索：方法论与插件在同一个研究里互相推动，本仓库是
> 整理后开源的插件源码。

## 功能

- **零配置工作区入口**：装好即用，不需要配置项目目录。DSH 侧栏的「流程图管理」按钮
  就地展开工作区清单；点哪个工作区，就在新标签打开哪个工作区的管理页（原 DSH 会话
  保留）。链接用 `?workspace=<id>` 绑定该工作区，页面读写的就是它里面的
  `docs/archify/`。
- **三页浏览**：项目首页（项目与业务列表）→ 业务页（介绍、业务文档入口、图列表——每图
  带快照数与当前状态徽标：一致／已改动／无快照）→ 阅读页（版本条、现场渲染的交互图、
  说明文档分块、源码证据）。
- **历史版本阅读**：保存的版本即 Git 附注标签；阅读页按版本条切换，图、说明与源码证据
  与所选版本同源（代码片段取自引用写定的固定提交）。
- **节点详情**：图上点节点即可读该步骤在当前所选版本里的那一节说明（没写、没文档、
  读不开、未分节都如实说明，不编造）。
- **保存版本（唯一写操作）**：在"当前（工作区）"视图上把已提交的图内容登记成一个有
  名称的版本；还有没提交的改动会被拦下并说明是哪个文件，页面上看到的内容与将要保存的
  不一致会要求先刷新，同一份内容同一阶段重复保存不会多存。
- **随 DSH 登录统一认证**：管理页与接口复用 DSH 的登录会话与来源校验；未登录或来源
  不受信任的请求会被拒绝（提示先通过 DSH 启动地址登录），认证服务不可用时一律拒绝
  （fail-closed）。
- **随包技能 archify-maker**：插件装载时注册到 DSH，安装后直接可用；提供"设计 → 实现 →
  证据 → 修改"四段流程指引与 workflow 图校验命令（内容见包内 `skills/archify-maker/`）。

## 安装

前置：已安装 DSH（DeepSeek Harness）。本插件在 DSH 0.1.6-alpha.2 的 web profile 上
做过从安装到移除的全链路验收（含工作区入口与统一认证）。宿主没有工作区注册表时，
管理页自动落回手动 `repoRoot` 模式（见第 4 步）。

1. 从 GitHub Release 下载 `specdev-dsh-archify-manage-<版本>.tgz`；
2. 安装：`dsh plugin --profile web add <tgz 路径>`（`--profile` 指定装进哪个 profile，
   **必填**；**路径不能含空格**——DSH 侧限制，含空格会报 ENOENT，先拷到无空格目录再
   add）；
3. 重启 DSH。不需要任何配置：侧栏点「流程图管理」展开工作区清单，点一个工作区，
   新标签打开该工作区的管理页，直接可用（沿用 DSH 登录会话）；
4. （兼容：手动指定项目目录）宿主没有工作区注册表、或想固定指向某个仓库时，仍可手动
   配置 `repoRoot`——插件默认不指向任何仓库，未配置且链接里也没有工作区标识时，页面
   会给出可复制的配置示例。配置层优先级（后者覆盖前者）：组合包层 → profile 自己的
   `cordis.patch.yml` → home 级 → `--patch` overlay。profile 层示例（**按 id 覆盖写法，
   勿用 `- insert:`**——insert 会新增重复条目导致启动失败）：
   ```yaml
   - id: specdev-archify-manage
     config:
       repoRoot: 'D:/你的/业务项目仓库'
   ```

## 业务项目的组织约定

插件按固定目录约定读取业务项目：

```text
docs/archify/
  project.json                        # 项目（schema: specdev-archify/project/1）
  <业务id>/business.json              # 业务（id / name / intro / docs）
  <业务id>/<图id>/chart.json          # 图（id / name / summary；图编号全项目唯一）
  <业务id>/<图id>/workflow.json       # 图源（Archify workflow JSON）
  <业务id>/<图id>/details.md          # 节点详情
  <业务id>/<图id>/evidence.json       # 源码证据引用
```

工作区模式下，工作区目录必须是 Git 仓库的**顶层**（子目录会被明确拒绝并说明，不会
悄悄改绑父仓库）；手动 `repoRoot` 模式沿用旧口径，不另加限制。

保存的版本 = 附注标签 `archify/<图编号>/<版本标识>`；读取时做五项校验（是附注标签、
剥壳后指向提交、标签 message 为合法 JSON 且必填字段齐全、图编号与标签名一致、目录以
约定根开头），不合规的计入"无效标签"并忽略，不当作快照。

## 页面与 API

页面与接口同源，且要求已登录 DSH（未登录访问会被拒绝并提示先通过 DSH 启动地址
登录）。从工作区清单进入的链接自动带 `?workspace=<id>`；没有标识时读取手动配置的
`repoRoot`。

| 路径 | 内容 |
|---|---|
| `/archify-manage/` | 项目首页：项目名 + 业务列表 |
| `/archify-manage/business/<业务id>` | 业务页：介绍、业务文档入口、图列表（快照数与状态徽标；编号冲突与说明文件问题会明确标出） |
| `/archify-manage/read/<业务id>/<图id>?v=current\|<标签名>` | 阅读页：版本条 + 现场渲染的交互图 + 说明文档分块 + 源码证据；图上点节点读详情；"当前（工作区）"视图可保存版本 |

API（同源）：`GET /api/workspaces` 列出 DSH 工作区（侧栏清单用）；其余为只读
`GET /api/inventory`、`/api/chart`、`/api/doc`、`GET /api/evidence`（留给脚本用）；
`POST /api/evidence` 接收页面正文的 evidence 原文做切片，防两次请求之间文件被保存造成
图与证据错配；`/api/snapshots` 是**唯一的写操作**——`GET` 为保存前检查（当前提交号、
能不能存、逐文件问题、内容摘要），`POST` 存一版（`head`/`fingerprint` 钉住确认过的
提交与内容，后台有新提交或内容对不上都会拒绝并要求刷新）。

## 从源码构建

Node ≥ 22。在本目录：

```sh
npm install                    # 安装开发依赖（esbuild / typescript）
npm run typecheck              # 类型检查（tsc --noEmit）
npm run build                  # 构建 dist/（esbuild 打包）
npm pack --pack-destination .  # 产出 specdev-dsh-archify-manage-<版本>.tgz
```

（可选）行为冒烟与接口层验收：`node scripts/smoke.mjs`、`node scripts/check-save.mjs`
——自包含，自动生成临时示例仓，不碰你的业务项目。

## 能力边界（如实）

- 唯一写操作是保存版本（挂附注标签）；**删版本、版本改名、跨仓库、推送远端不在范围**。
- 已验证环境：DSH 0.1.6-alpha.2（web profile；工作区入口与统一认证全链路验收）、
  Windows、单机。手动 `repoRoot` 模式由随包接口层脚本 `scripts/check-save.mjs` 覆盖
  （自建假宿主，与宿主版本无关）。未做真实 AI 会话的端到端验收（技能触发 → 按技能读
  参考 → 产出），也未在另一台机器上验证。
- 节点级增强阅读目前是第 1 步（选中同步 + 节点详情阅读）；节点关联跳转、节点详情与
  源码对照过滤、页面内问 DSH 属后续版本。
- 渲染与校验依赖随包分发的 Archify 渲染器副本（MIT），见 `vendor/archify-renderer/`；
  副本升级由维护者进行。

## 许可证

MIT（许可证文件见仓库根 `LICENSE`）。随包分发的 Archify 渲染器副本同为 MIT，其许可证与
第三方声明随副本携带于 `vendor/archify-renderer/archify/`（`LICENSE`、
`THIRD_PARTY_NOTICES.md`）。
