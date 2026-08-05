# Spec — Document Library (②) & Continuable Sessions (③)

> 状态：Proposal，待评审后实现。作者：Claude Code · 2026-08-04。
> 前置：本 spec 假设 **PR #7（startup profile onboarding）已合并**（即 `Company.profile` 已存在）。
> 相关：[`HARNESS_ROADMAP.md`](./HARNESS_ROADMAP.md)（本 spec 的 ② 是其 P3 文档层的起点）。
> 原则：保留确定性 VC 判定层不变；文档不可变（内容寻址）；session 变成“承接式多轮 thread”。

## 0. 目标（一句话）

1. **文件库（②）**：用户上传的文件进入其**个人文件库**并编号；公司/session 只**引用文件 ID**，不再内联文件本身；同一文件不重复存。
2. **可继续的 session（③）**：每一轮评审保存当时的“文件 + startup profile + 记录 + 结论”；用户更新信息后，可在同一 session 下**承接上一轮继续讨论**（按 A 方案：新开一轮、承接上一轮，而非往同一 run 追加）。

## 1. 与现状的关系（先明确“已经有的”）

- 每次 run 已经通过 `ModeRun.companySnapshot` 快照了公司信息（含 #7 的 `profile`）。
- transcript 已持久化（`Turn` 投影 + P1 的 `RunEvent` 重放日志）；结论存 `ModeRun.result`。
- 已有 `ModeRun.inheritedFromId` 自关联，仅用于 **screening → IC** 的跨模式漏斗，携带 `{ crux, by_role }`。

因此**真正新增的**只有三件事：`Document` 实体 + 引用；把“当时的文件”从内联文本改为文件 ID 快照；**同模式承接**的续轮机制。

---

## 2. 文件库（②）

### 2.1 数据模型

```prisma
model Document {
  id        String   @id @default(cuid())
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  fileName  String
  ext       String                 // pdf | docx | txt | md
  mimeType  String?
  sizeBytes Int
  hash      String                 // sha256(原始字节) → 去重
  text      String   @db.Text      // 提取出的文本（评审团读的就是它）
  createdAt DateTime @default(now())

  @@unique([ownerId, hash])        // 同一用户同一文件只存一份（= 天然“编号/去重”）
  @@index([ownerId])
}
```

- **不可变**：`Document` 一旦创建不修改。“更新文件” = 上传新文件 = 新 `Document`（新 id）。
- **原始字节**：本期**只存提取文本**（沿用现有 unpdf/mammoth）。原始文件入对象存储留到 harness P3，不在本期。
- **编号**：canonical 引用就是 `id`。UI 可另给每用户一个人类友好的序号（可选，见开放问题）。

### 2.2 公司如何引用文件（替代内联 bp）

- `Company` 增加 `documentIds String[]`（有序，支持**多文件**——顺带把之前搁置的多文件做了）。
- 保留旧 `Company.bp` / `bpFileName` 列仅作 legacy，不再写入（迁移见 2.5）。
- 评审团读的语料 = `assembleProfile(topic, profile, 文档们的 text 拼接)`（把 #7 的 `assembleProfile` 的 `fileText` 从单串扩成“多文档 text 拼接”）。

### 2.3 API

- `POST /api/documents`（multipart）→ 提取文本 → 算 hash → `upsert by [ownerId, hash]` → 返回 `{ id, fileName, ext, sizeBytes }`。重复上传命中同 hash 直接返回既有 id（去重）。
- `GET /api/documents` → 当前用户文件库列表（供“从库中选择”）。
- `DELETE /api/documents/:id` → owner 校验；**若被任何 run 快照或 company 引用则软删/拒删**（避免悬空引用，见开放问题）。
- 旧 `POST /api/upload` 保留或改为内部走 `/api/documents`。

### 2.4 编辑体验

公司编辑（#7 的 StartupFields）里，上传区从“单文件”变“文档列表”：可**新上传**或**从文件库选**；每个文档一行（文件名 + ✕ 移除引用，移除≠删库）。

### 2.5 迁移

- 对每个 `bp` 非空的 `Company`：建一个 `Document`（`fileName = bpFileName ?? "document"`，`text = bp`，`hash = sha256(bp)`），设 `documentIds = [doc.id]`。
- 历史 run 不动（它们的 `companySnapshot.bp` 已冻结当时文本）。
- Prisma `db push` + 一段一次性 backfill 脚本（`packages/db/prisma/` 下）。

---

## 3. 可继续的 session（③，A 方案：承接式新 run）

### 3.1 概念模型

- **Session / Thread** = 同一公司上、一串**相互承接的 run**（round 1 → round 2 → …）。
- Round N+1 **承接** Round N：携带上一轮的 `result` + 讨论摘要 + “本轮新增/更新了什么”，再叠加**本轮当时**的 profile/文档快照。
- 默认**同模式**续轮（更新信息后再来一次 Screening）。跨模式漏斗（screening→IC）仍走既有 `inheritedFromId`，两者概念区分。

### 3.2 数据模型

```prisma
model ModeRun {
  // ...现有字段...
  threadId    String?   // 同一 session 的所有 run 共享；新 session = 自己的 id
  parentRunId String?   // 承接自哪一轮（同模式续轮）
  parent      ModeRun?  @relation("RunThread", fields: [parentRunId], references: [id], onDelete: SetNull)
  followups   ModeRun[] @relation("RunThread")
  digest      String?   @db.Text  // 本轮完成时生成的一段讨论摘要，供后续轮承接（省 token）
  // companySnapshot 增加 documentIds（当时引用的文件），profile 已在 #7 快照
}
```

- 新 run 无 parent → `threadId = 自己 id`（单轮 thread）。
- 续轮 → `parentRunId = 上一轮`，`threadId = 上一轮.threadId`。
- `digest`：run 结束时用一次 host LLM 调用生成“本轮结论 + 关键分歧 + 建议”的短摘要，缓存下来；续轮读它而不是塞整段 transcript（控制 token）。

### 3.3 续轮时喂给引擎的“前情”

扩展 `RunContext`（engine）新增可选 `priorRound`：

```ts
priorRound?: {
  mode: Mode;
  result: unknown;         // 上一轮结构化结论
  digest: string;          // 上一轮讨论摘要
  whatsNew: string;        // 本轮相对上一轮：新增/更新了哪些 profile 字段、加了哪些文件
}
```

- 每个 mode 的 system prompt 增加一段前言：“这是**续轮**。上一轮结论=…；讨论要点=…；创始人这次更新了=…。请在此基础上继续，重点关注变化是否改变你的判断。”
- 判定纯函数**不变**：续轮仍跑该 mode 正常的确定性流程，只是 persona 发言带着前情。
- `whatsNew` 由 web 在建 run 时计算（对比 parent 的 `companySnapshot` 与当前 company 的 profile/documentIds 差异）。

### 3.4 API

- 复用 `POST /api/runs`，请求体加可选 `parentRunId`：
  - 校验 parent 属于同一 user、同一 company、**同 mode**（跨模式仍走 `inheritedFromId`）。
  - 设置 `parentRunId`、`threadId = parent.threadId`、快照当前 profile/documentIds、计算 `whatsNew`。
- run 完成时（worker）：生成并存 `digest`。

### 3.5 UI

- **History 按 thread 分组**（③需要，也和“History 列在四个模式下面”配合——但后者归 A）。一个 thread 显示成一串轮次（round 1/2/3…），每轮有自己的结论徽章。
- session 详情底部加 **“更新信息并继续讨论”**：→ 引导用户改 profile/加文件 → 以 `parentRunId=本轮` 新建同模式续轮 → 跳到新 run。
- 每轮点开看到的是**那一轮当时**的 profile/文件快照 + 记录 + 结论（满足“每次对话保存当时信息”）。

---

## 4. 迁移与兼容

- 新增：`Document` 表、`Company.documentIds`、`ModeRun.threadId/parentRunId/digest`、`companySnapshot.documentIds`。
- 历史 run：`threadId` 回填为自身 id（单轮）；照常可查看，不受影响。
- 一次性 backfill：Company.bp → Document（见 2.5）。
- 照例合并后手动 `prisma db push` + 跑 backfill 脚本（Railway 不自动迁移）。

## 5. 建议实现顺序（②③ epic）

1. **②-a 文件库后端**：`Document` 模型 + `/api/documents` + 去重 + `assembleProfile` 支持多文档 + backfill。
2. **②-b 文件库前端**：StartupFields 的上传区改成“文档列表 + 从库选择”（会和 A 的新 UI 对齐——A 之后做，避免重复改 UI）。
3. **③-a 续轮后端**：`threadId/parentRunId/digest` + `POST /api/runs` 支持 `parentRunId` + `RunContext.priorRound` + 各 mode prompt 前言 + digest 生成。
4. **③-b 续轮前端**：History 按 thread 分组 + session 底部“更新并继续讨论”。

## 6. 开放问题（实现前需拍板）

1. **文件编号**：只用 `id`，还是给每用户一个可见序号（Doc #1、#2…）？后者需一个 per-user 计数器。
2. **删文件**：被历史 run 快照/公司引用的 `Document` 允许删吗？建议**软删**（标记 hidden，不物理删，避免悬空）。
3. **原始文件预览**：本期只存文本；要“原样预览 PDF”需对象存储（harness P3），确认是否推迟。
4. **续轮的 `whatsNew` 粒度**：只列“改了哪些字段/加了哪些文件”，还是也做字段级 diff 文本？建议先粗粒度。
5. **digest 生成时机与成本**：每轮结束固定生成 vs 仅在被续轮时按需生成？建议结束即生成（一次性、可缓存）。
6. **跨模式续轮**：是否允许 thread 内换模式（如 Screening→再 Board）？建议 v1 只同模式续轮；跨模式仍用现有 `inheritedFromId` 漏斗。
7. **token 预算**：`priorRound` 注入上限（digest 长度、whatsNew 长度）。

## 7. 验收标准（②③）

- 同一文件传两次只存一份（同 hash 命中）；session 存的是文件 id，不是文件本身。
- 更新 profile/加文件后能在同一 thread 下发起续轮；续轮 persona 明显针对“变化”发言。
- 打开任意一轮，看到的是**那一轮当时**的文件/profile/记录/结论（历史轮不被后续更新污染）。
- 历史 run 无需迁移即可继续查看；判定纯函数在相同结构化输入下结果不变。
- 删除被引用的文件不产生悬空引用（软删）。
