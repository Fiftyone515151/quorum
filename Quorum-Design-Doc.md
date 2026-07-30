# Quorum —— 多人格圆桌评议引擎 · 完整设计文档

> **产品名：Quorum**（"做决定所需的法定人数"——一群被召集来评议并给出结论的头脑）。

## Context（为什么做这个）

做一个「多人格圆桌评议引擎」：用户设定最多 **5 个角色**（历史名人 / 虚构角色）+ 一个主题，角色从各自视角评议、可自发讨论，用户也能实时加入。产品 = **一个通用引擎 + 围绕四个目标组织的场景**。两个旗舰 case：**简历筛选**、**VC 投决会**。

参考项目：**airoundtable**（配置即角色/场景）、**council-of-high-intelligence**（重点：人设=分析工具而非扮演、分阶段协议、证据分级、保留分歧的裁决）。

**语言**：网页 UI 全部用**英文**构建；用户输入（主题、角色设定、材料、插话）可用任何语言。

**已确认技术栈**：TypeScript 全栈（Next.js）；**provider = Qwen API + DeepSeek API**（角色可在两者间路由防同质化；Synthesizer 用 DeepSeek）；去中心化 A2A 讨论（bid 竞价 + arbiter 排序实现）；Web 应用。

> ⚠️ 约束：**未经用户明确指示（"做/开始/渲染"），不生成任何 Artifact。**

---

## 一、产品主流程：组织 → 讨论 → 结果（目标为主线，绑死）

**目标绑死讨论方式 + 产出形态**（不自由拼装，降工程难度）。选定目标即锁定后两段。四种目标是唯一的顶层选择：

| 目标 | 讨论方式（绑定） | 产出形态（绑定） | 旗舰 case |
|---|---|---|---|
| **决策** Decision | 结构化评审（分阶段 + 强制表态） | 裁决书：结论 + 分裂票数 + kill criteria | VC 投决会 |
| **打分筛选** Screen | 结构化 + 各自独立打分 | 评分卡 + 排名 + 红旗台账 | 简历筛选 |
| **改进优化** Improve | 自由讨论 + 逐条挑刺 | 改进建议清单（可执行 diff） | 通用 |
| **开放探讨** Explore | 自由群聊 A2A | 观点综述（保留分歧，不强求结论） | 通用 |

底层只需 **2 条讨论策略**（`structured` / `freeform`）+ 不同 outputSchema 组合。duo（一对一辩论）列为未来。

---

## 二、四个目标的 Workflow（定稿）

**通用规则**：
- **编排 = 确定性工程代码，不是 LLM Host。** 轮次/阶段推进、发言排序(bid+arbiter)、计票、算平均、终止、插话路由、跨场次 memory 载入、异常处理全部写在代码里，不交给 LLM 自由发挥。
- **唯一的 LLM 综合角色 = Synthesizer（用 DeepSeek，不呈现在对话里，只在讨论结束后跑一次）**：负责需要自然语言总结的产出——主要是开放探讨的综述。决策/打分的产出由代码从票数/分数 + 各角色自己的依据拼装；改进清单由代码聚合（可选 DeepSeek 润色）。
- **终止是确定性的**：由用户选的轮次(maxRounds) / 各目标工作流规则决定，不做 LLM 收敛判定。
- **不做强制约束**：不设 council 式"防过早同意/防重复/强制异见"，也不做证据分级(FACT/INFERENCE…)。但角色发言/打分仍需给出"依据"（工作流本身的要求）。
- **一轮 = 每个角色各发言一次**（所以 5 轮 = 每人最多说 5 次）。
- 材料上传（组织阶段带「+」的框）四模式通用。
- 结果均支持导出 **PDF + 分享二维码 + 链接**。
- **四个模式都支持跨场次带 memory 迭代**（代码载入上一场 transcript + 结果 + 材料喂给角色，角色在正常讨论中自行点评改进；非 Host 完成）。
- **异常处理**：角色模型调用失败 → 持续重试；最终仍失败 → 直接报错（不静默跳过、不自动换 provider）。

### 1. 决策 Decision
- **组织**：主题 + 角色（**强制 3 或 5 人，奇数**）+ 提示"决策模式不可插话" + 轮次（up to 5）。
- **讨论**：第 1 轮角色轮流发言；之后各轮自由发言；全程锚定"得出是/否"。
- **结果**：结论（**简单多数**）+ 投票表决 + 每个角色的评价依据与建议。
- **结束后**：用户可**同场次**补材料/context 继续讨论（若不服结果）。

### 2. 打分筛选 Screen
- **组织**：主题 + 角色 + 提示"不可插话" + 轮次。
- **讨论**：各角色出初始分 + 依据 → 算平均 → 各角色表态是否接受该平均分 → 不接受则继续讨论（每次给分都要依据），目标是全员接受平均分；**到轮次上限则强制收敛，取当前平均分**。
- **结果**：打分 0–100 + 每个角色详细建议与评分依据。
- **迭代**：不可当场续讨；可保存，下次传改进版**开新场次**、载入上次 memory 并点评改进之处（组织细节可重设）。

### 3. 改进优化 Improve
- **组织**：主题 + 角色 + **可选是否插话** + 轮次（up to 5）。
- **讨论**：各角色先发表建议 + n 条改进建议 → 各角色批评场上某角色的建议、被批方回应并决定是否修改 → 用户可随时在底部对话框补充/批评某角色。
- **结果**：一份改进建议清单（**不需全体同意**）。
- **结束后**：用户可选择是否继续。

### 4. 开放探讨 Explore
- **组织**：主题 + 角色 + **可选是否自由插话** + 轮次（up to 10）。
- **讨论**：各角色先依次发表 → 之后各轮可批评某角色 / 继续自由发表 / 补充某角色观点。
- **结果**：由 **Synthesizer（DeepSeek，不呈现）** 在讨论结束后通读全场，写一份综述。

**插话规则**：改进/开放需先开"插话开关"；决策/打分在出结果前不允许插话。

---

## 三、组织阶段（UI 设计）

- **主题**：一个聊天框，自由输入。
- **材料上传**：聊天框下方一个带「+」的框，文案 "Drop in anything you want discussed — resume, book, BP…"。
- **角色**：最多 5 个（决策模式限 3 或 5）。来源 = **预设库挑选** + **用户自由输入**。
- **自定义角色两种 mode**：
  - **历史名人 mode**：AI 搜索该名人 → 按四字段（生平/代表观点/说话风格/已知立场）打包。**库里已有的不需确认；库里没有的让用户确认后入库。**
  - **自由角色 mode**：身份/角色（职业或关系型，如"同级同学"）+ 年龄段（1–100，每 10 年一段）+ **主人格（单选）** + 可选"视角/最在意什么"(lens)。

**人格标签**（MECE，5 个默认评判立场，**主人格单选**）：

| 标签 | 默认评判立场 |
|---|---|
| **Critical** | 默认怀疑，盯弱点/风险/漏洞 |
| **Supportive** | 默认鼓励，先看优点与潜力 |
| **Analytical** | 默认中立，只跟证据与逻辑 |
| **Pragmatic** | 默认务实，只问能否落地 |
| **Visionary** | 默认想象，看野心与长期上限 |

（可选的"次要语气"字段留作后续。）

---

## 四、预设角色库（三层货架）

每个预设内置人格 + 视角 + 说话风格，选了可再编辑；库可按人格标签/目标场景筛选；软提示补齐缺失视角（不强制配对——**已取消对立配对**）。

- **A. 功能原型（虚构、跨场景）**：The Skeptic/刁钻记者(Critical)、The Champion/铁杆支持者(Supportive)、The Analyst/数据控(Analytical)、The Operator/实干家(Pragmatic)、The Visionary/远见者(Visionary)、The End User/用户代表、The Peer/同级同学。
- **B. 场景套装（一键成团）**：Hiring Panel = Recruiter · Hiring Manager · Senior IC/Bar-raiser · Skeptical Interviewer · Culture Fit；VC IC = Managing Partner · Growth Partner · Risk Partner · Domain Expert · Devil's Advocate。
- **C. 历史名人（20 人，女性 7 位 ≈35%）**：Socrates, Aristotle, Lao Tzu 老子, Sun Tzu 孙子, Machiavelli, Marcus Aurelius, Leonardo da Vinci, Charles Darwin, Marie Curie, Ada Lovelace, Feynman, Kahneman, Charlie Munger, Warren Buffett, Steve Jobs, Hannah Arendt, Jane Goodall, Grace Hopper, Florence Nightingale, Simone de Beauvoir。
  - 详细四字段 background 见 `persona-library-historical.md`。

---

## 五、讨论引擎：去中心化 A2A 工程化

纯去中心化会死循环/垄断/围攻。做法 = **bid 竞价 + 轻量 arbiter 排序**（arbiter 只排序不改内容）：

1. 每轮所有可发言角色先做**廉价 bid**（要不要发言 + 紧迫度 0~1 + 一句话理由）。
2. **arbiter** 取最高 bid，反垄断：近期发言者衰减、保证异见有发言权、round-robin 兜底。
3. 选中角色产出完整发言（流式）。
4. 用户消息优先抢占（仅在允许插话的模式/时机）。
5. 终止：轮次耗尽(maxRounds) / 用户提请表决。（确定性，无 LLM 收敛判定。）

**两条讨论策略**（`DiscussionStrategy` 接口，纯代码）：
- **Structured**（决策/打分）：分阶段回合，确定性排序（不做强制约束）。
- **Freeform**（改进/开放）：上面的 bid 去中心化 A2A，用户随时插话。

---

## 六、技术栈与架构

- **框架**：Next.js（App Router）全栈 TS；前端 React + Tailwind + shadcn/ui。
- **多代理编排**：**独立 Node worker** 跑长时讨论循环（避开 serverless 超时）；**Redis pub/sub** 下发指令/接收发言事件；**SSE** 流式推给浏览器。
- **LLM 接入**：**Vercel AI SDK**，provider = **Qwen（`@ai-sdk/qwen` 或 OpenAI 兼容端点）+ DeepSeek（`@ai-sdk/deepseek`）**，原生流式。角色在两者间路由防同质化；Synthesizer 固定 DeepSeek。
- **持久化**：Postgres + Prisma；Redis 兼作发言队列/锁。
- **认证**：Auth.js，登录方式 = **邮箱 + Google**。
- **导出/分享**：PDF + 二维码 + 链接。

---

## 七、数据模型（Prisma 核心表）

- **Persona**（角色库）：id, name, kind(historical|archetype|custom), bio/代表观点/说话风格/已知立场（历史名人四字段）, identity(身份/角色), ageBand, **primaryTrait**(critical|supportive|analytical|pragmatic|visionary), lens(可选视角), speakingStyle, isPreset, ownerId, visibility。
- **Scenario/GoalPreset**（目标预设）：goal(decision|screen|improve|explore), discussionStrategy(structured|freeform), outputSchema, defaultRoster, rubric, phaseProtocol, allowUserInterjection。
- **Session**：goal, topic, status, participants(≤5), maxRounds, allowInterjection, createdBy, **parentSessionId**(跨场次迭代链)。
- **SessionParticipant**：sessionId, personaId, providerOverride, modelOverride, seatRole, order。
- **Artifact**（材料）：sessionId, type(resume|deck|book|text|file), content/fileRef。
- **Message**：sessionId, round, phase, authorType(persona|user|system), authorId, content, bidScore, replyTo, tokens, cost, provider, model。
- **Result**：sessionId, kind(verdict|scorecard|improvements|synthesis), payload(按 goal 的 outputSchema), voteTally, killCriteria, avgScore…
- **编排 = 工程代码**（非 agent）；**Synthesizer**（DeepSeek）仅在讨论结束后运行，生成需要 NL 总结的产出（主要开放探讨综述），不参与、不呈现。

---

## 八、目录结构

```
/apps
  /web            Next.js（UI + CRUD API + SSE /api/sessions/:id/stream）
  /orchestrator   Node worker：讨论引擎主循环 + Host
/packages
  /engine
     personas/     角色注册 + prompt 组装（含历史名人四字段打包 + AI 搜索）
     goals/        四个目标预设：decision / screen / improve / explore
     discussion/   DiscussionStrategy：structured / freeform / arbiter / bidding（纯代码编排）
     synthesizer/  DeepSeek 综合器：仅结束时写综述等 NL 产出
     providers/    provider 抽象(AI SDK) + Qwen/DeepSeek 路由 + 成本/token 统计
     synthesis/    各目标产出构造（裁决书/评分卡/建议清单/综述），计票+算平均为纯代码
     memory/       跨场次迭代：载入 transcript+结果+材料，生成"改进点评"
     schema/       zod：inputSchema / outputSchema / message / result
  /db             Prisma schema + client
  /ui             共享 React 组件（流式聊天流、scorecard、verdict、综述面板）
```

---

## 九、成本 / 延迟策略
- bid 用廉价/快模型；角色发言在 Qwen/DeepSeek 间路由；Synthesizer 综述用 DeepSeek。
- 并发上限；流式营造实时感；共享 context/材料用 prompt caching；逐条记 token+成本，按 session 预算兜底。

## 十、风险与取舍
- 去中心化 A2A 死循环/垄断 → arbiter 反垄断 + maxRounds 兜底。
- 打分不收敛 → 到轮次上限强制取当前平均。
- serverless 超时 → 独立 worker + Redis + SSE。
- 多 provider（Qwen/DeepSeek）复杂度 → AI SDK 统一；调用失败持续重试，最终失败直接报错（不自动换 provider、不降级）。
- 历史人物 = 分析工具非扮演（存 method+盲区）；AI 搜索需防瞎编（库里没有的让用户确认）。

## 十一、MVP 路线
- **M0**：引擎核心（personas + freeform bid 循环 + host + 单 provider）+ CLI 验证讨论质量。
- **M1**：Next.js UI + SSE 流式聊天 + 组织阶段（主题/材料/角色）+ 登录（邮箱+Google）+ Claude 单家。
- **M2**：structured 协议 + 四目标产出契约；**简历筛选（打分）**端到端。
- **M3**：**VC 投决会（决策）**；多 provider 路由；导出 PDF/二维码/链接。
- **M4**：改进/开放两模式 + 跨场次 memory 迭代 + 预设库 CRUD + 用户自定义角色（历史名人搜索打包）。

---

## 待定
- Host Agent 的具体 prompt/编排细节；保存与分享的交互细节。
