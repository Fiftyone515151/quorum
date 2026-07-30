# Quorum PRD v2

> 一个模拟 VC 评审团、为融资中的 founder 提供评估 / 决策 / 改进建议 / 发散讨论的系统。
> 本版修复了 v1 的角色数量矛盾、初筛 sponsor 污染、维度绑定缺失、董事会字段缺失等问题。
> 所有判定逻辑均已定义到可直接实现的程度。

---

# 0. 全局共享设定

四个模式共用以下定义。各模式只是以不同方式**读取**这些共享设定。

## 0.1 六个评估维度（dimensions）

所有打分类模式（初筛、投决会）都基于这六个维度。取值 1–10。

| key | 维度 | 含义 |
|---|---|---|
| team | 团队 | 创始人是否 founder–market fit、能否搭起班子 |
| market | 市场 | TAM、时机、赛道 |
| product | 产品 | 是否 10x 而非增量 |
| traction | 牵引力 | 是否有真实早期数据 |
| moat | 壁垒 | 能否防住抄袭 |
| business_model | 商业模式 | 单位经济、变现路径 |

## 0.2 五条董事会风险轴（risk_axes）

董事会的覆盖检查基于这五条轴（对应"funded startup 到不了下一轮"的独立失败原因）。

| key | 轴 | 失败方式 |
|---|---|---|
| capital | 资本 | 钱烧没了 |
| team | 团队 | 执行不出来 |
| market | 市场 | 方向错了 |
| growth | 增长 | 长不够快 |
| product | 产品 | 产品做不出/做偏 |

## 0.3 三阶段维度权重表（总和 100）

按 founder 所选融资轮次加载对应列。做成前端可调滑块。

| 维度 | pre-seed | seed | A |
|---|---|---|---|
| team | 35 | 25 | 15 |
| market | 30 | 25 | 20 |
| product | 15 | 20 | 15 |
| traction | 5 | 15 | 25 |
| moat | 10 | 10 | 10 |
| business_model | 5 | 5 | 15 |

## 0.4 角色池与角色标签（核心架构）

**四个模式都从同一个角色池自由选择。** 每个角色带三类标签,机制读标签而非写死座位——这是"自由选角色"与"结构化判定"能共存的关键。

角色数据结构：

```
Role {
  id:               string
  name:             string
  type:             "vc" | "persona"
  dimensions:       dimension[]   // 它有资格给哪些维度打分（初筛/投决会用）
  risk_axes:        risk_axis[]   // 它守哪条董事会风险轴（董事会覆盖检查用）
  stance_tendency:  "optimist" | "neutral" | "skeptic"  // 投决会指派champion/dissenter用
  system_prompt:    string        // 角色契约：方法论 / 已知盲点 / 固定输出格式 / 倾向
}
```

默认角色池（用户可在此基础上自由增减；每个都已打好标签）：

| 角色 | type | dimensions | risk_axes | 倾向 |
|---|---|---|---|---|
| 通才合伙人 | vc | team | team | neutral |
| 技术合伙人 | vc | product, moat | product | neutral |
| 市场合伙人 | vc | market, business_model | market | neutral |
| 增长合伙人 | vc | traction, market | growth | optimist |
| 财务合伙人(CFO型) | vc | business_model, traction | capital | skeptic |
| 风控/魔鬼代言人 | vc | moat, team | capital, team, market, growth, product | skeptic |
| 运营独立董事 | persona | team | team | neutral |
| 行业专家 | persona | market, product | market, product | neutral |

> `system_prompt` 必须把该角色的**方法论、已知盲点、固定输出格式、立场倾向**写死,否则同一模型驱动的角色会坍缩成同一个声音。尤其"增长合伙人(倾向投入换增长)"与"财务合伙人(倾向留余粮)"要把对立写进各自 prompt。

## 0.5 自由选角色的通用规则

- 四个模式默认 5 个角色,用户可自由增减、从池中任选。
- **机制只认标签,不认具体是谁**：初筛/投决会打分认 `dimensions`；董事会覆盖检查认 `risk_axes`；投决会指派 champion/dissenter 认 `stance_tendency`。
- 因此自由选角色不会破坏任何判定逻辑；唯一风险（视角有缺口）由各模式的 host 兜底（见下）。

## 0.6 各模式输入（保留 v1 格式）

- **初筛会**：Startup 名称、BP
- **投决会 / 董事会**：Startup 名称、BP、融资币种(人民币/美元/其他)、估值(可空,单位可切)、本次融资规模(可空,单位可切)、融资轮次(pre-seed/seed/A)
- **下午茶**：同上 + 可选 topic

## 0.7 四个模式的 Host Agent 对照（一览）

| 模式 | Host 角色 | 核心职责 | 是否出裁决 |
|---|---|---|---|
| 初筛会 | 纪律官 | 隔离独立表态、只挑分歧点、暴露 crux | 否（规则算 outcome） |
| 投决会 | 施压者 | 点 champion、指派 dissenter、逼表态 | 否（规则算 verdict） |
| 董事会 | 议长/收敛者 | 管 founder 回应、覆盖检查、排序 | 否（出优先级清单） |
| 下午茶 | 催化剂 | 冷场点火、防霸屏、绝不收敛 | 否（只归纳线索） |

> Host 一律用**结构化调度**输出（该谁发言 / 哪条轴缺口 / 优先级如何），由代码驱动,不生成主持词。

---

# 1. 项目初筛会（Screening）

## 目标

快速分诊（triage），不是全面评估。产出一个**去向**（outcome），核心是"快速找到说不的理由"。对 founder 最值钱的输出是「你会因为什么被 pass」+「你现在答不上来的关键问题（crux）」。

## 组织阶段

- **输入**：Startup 名称、BP。（阶段用于加载权重表；若初筛不单独收轮次，默认 seed，或继承上游。）
- **角色选择**：默认 5 人,从角色池自由选。**全部为中立评估者,不预设 sponsor / 拥护者**（sponsor 是投决会机制,放这里会污染独立表态）。
- **founder**：不在场,提交材料后等待,**不可插话**。

## 讨论阶段（3 段,含 Host）

**第 1 段 · 独立表态（背对背）** — host 只收集,不介入内容。
每个角色**在不看他人意见的前提下**,对自己 `dimensions` 内的维度打分(1–10)+ 一句依据,并输出 `is_fatal` / `will_advance` 标记。隔离是为防趋同。

**第 2 段 · 聚焦分歧** — host 上场。
host 只挑分歧最大的 1–2 个点,点名持相反意见的两个角色正面各说一句。把"5 人各说一段"压缩成"就关键分歧说一轮"。上限：最多 2 个分歧点。

**第 3 段 · crux 收口** — host 总结,不裁决。
host 汇总：主要分歧、有无致命、有无 will_advance、以及"要推进必须先回答的 2–3 个问题(crux)"。outcome 由规则算,host 只整理结构化输入。

## 结果

### 每个角色产出字段

```
per_dimension_scores: { [dimension]: {score: 1-10, reason: string} }  // 仅自己 dimensions 内
is_fatal:     bool
fatal_reason: string
will_advance: bool   // 愿不愿让它进下一轮（比投决会 champion 门槛低：愿继续看，而非押名声）
```

### 系统计算（定死的公式）

```
# 维度聚合：每个维度取"有资格评它的角色"的均值（维度内平均是合法的）
for d in 6 dimensions:
    contributors = roles where d in role.dimensions
    if contributors is empty:
        mark d as UNCOVERED (记入 coverage_gaps)
    else:
        dim_score[d] = mean(role.per_dimension_scores[d].score for role in contributors)

covered = dimensions with contributors
W = sum(stage_weight[d] for d in covered)          # 归一化分母
综合分 = ( Σ_{d in covered} dim_score[d] * stage_weight[d] ) / W * 10   # 值域 10–100
尖刺分 = max(dim_score[d] for d in covered)          # 1–10
致命标记 = any(role.is_fatal)
兴趣标记 = any(role.will_advance)
分歧度 = stddev( per_role_mean )                     # per_role_mean = 该角色各维度分的均值
```

### 判定流程（确定性,按顺序,先命中先返回）

```
# —— 闸门 ——
1. if 致命标记:            → PASS(dealbreaker，附 fatal_reason)
2. elif not 兴趣标记:       → PASS(no_interest，没人愿意继续看)
# —— 分级 ——
3. elif 综合分 >= T_high(默认70) or 尖刺分 >= T_spike(默认9):  → ADVANCE
4. elif 综合分 >= T_mid(默认50):                              → WATCH
5. else:                                                     → PASS(below_bar)
```

> 规则 3 的 **"或"** 是"不取平均"的落点：综合分不高但有 9 分尖刺,依然 ADVANCE。T_* 为可调默认值。

### 去向路由

- **ADVANCE → 投决会**（route 固定为投决会）。分歧度作为附带信号写入输出,但不再分叉到不同去向。
- WATCH / PASS 无 route。

### 三种去向的含义

| outcome | 触发 | 给 founder 的话 |
|---|---|---|
| ADVANCE | 无致命 + 有兴趣 + 分数达标或有尖刺 | 进入下一轮(投决会)。先准备好回答：[crux] |
| WATCH | 无致命 + 有兴趣 + 分数中等 | 暂不推进,值得复看。差在：[短板] |
| PASS | 命中致命 / 无人有兴趣 / 分数过低 | 否。原因：[致命理由 / 无人感兴趣 / 未达门槛] |

### 边界情况

- 多个致命：任一 is_fatal 即走规则 1,不看分数。
- 分数高但有致命：依然 PASS（闸门优先于分数）。
- 分数低但有强尖刺：规则 3 尖刺条款捞成 ADVANCE（刻意,别埋掉可能的怪物）。
- 全员温吞 will_advance=true 但分数尖刺都不高 → 落 WATCH。
- crux 未解不影响判定：初筛只把 crux 当"必答问题"输出,不要求已解决。
- 某维度无人评 → 剔除并归一化,写入 coverage_gaps 提示 founder。

### 输出结构

```
{
  outcome:        "ADVANCE" | "WATCH" | "PASS",
  route:          "投决会" | null,        // 仅 ADVANCE
  reason:         string,
  score:          综合分,
  spike:          尖刺分,
  divergence:     分歧度,
  crux:           string[],               // 必答 2–3 个问题，不要求已解决
  by_role:        [{role, dimension_scores, reason}],
  dealbreaker:    string | null,
  coverage_gaps:  dimension[]             // 没人评的维度
}
```

---

# 2. 投决会（Investment Committee）

## 目标

慎重、对抗、每个人对最终决定负责。产出投/不投的 **verdict**。不是再打一次分。

## 组织阶段

- **输入**：Startup 名称、BP、融资币种、估值(可空)、融资规模(可空)、融资轮次。
- **角色选择**：默认 5 人,从池自由选。**champion 与 dissenter 不是预选座位,而是 host 在会中动态指派**（见讨论阶段）——所以自由选不破坏裁决。
- **founder**：不在场,**不可主动插话**,但可被 host "传唤"回答特定问题。

## 讨论阶段（4 段,含 Host）

**第 1 段 · champion 陈述** — host 点将。
host 在 `will_champion=true` 的角色里选 conviction 最高者（若并列,选 stance_tendency=optimist 者）为 champion,让他做 the case for investing。**若无人 will_champion,host 直接宣布 PASS,会不用开。**

**第 2 段 · 结构化反对** — host 指派。
host 指定一名 designated dissenter（选 stance 最负 / conviction 最高的反对者；**若全员正面,强制 stance_tendency=skeptic 或最不积极者红队**）,唯一任务是把项目往死里打。这保证无论怎么选角色,桌上永远有对抗。

**第 3 段 · 攻防聚焦 crux** — host 主持,只围绕 crux。
正反双方就决定生死的 crux 交锋,其他角色只在自己领域补证据。与初筛不同：投决会必须**试图解决** crux。必要时 host 向 founder 传唤一个问题,founder 当场作答,直接影响结果。

**第 4 段 · 表态与裁决** — host 逐个逼问 stance / conviction / 理由 / 最担心的风险,然后规则算 verdict。

## 结果

### 核心原则：不投票、不平均

verdict 由三个正交信号推导：**Champion(上限) / Fatal(下限) / Crux(关键疑问)**。

### 每个角色产出字段

```
stance:        "invest" | "pass" | "conditional"
conviction:    1-5
will_champion: bool
is_fatal:      bool
fatal_reason:  string
```

### Host 在攻防后补（全流程唯一需理解语义的判断）

```
fatal_resolved: bool     // 致命反对是否被 champion 当场回应掉
crux:           string
crux_resolved:  bool
```

### 判定流程（确定性,按顺序,先命中先返回）

```
1. if not any(will_champion):               → PASS(no_conviction)
2. elif any(is_fatal) and not fatal_resolved: → PASS(unresolved_dealbreaker)
3. elif crux_resolved:                        → INVEST
4. else:                                       → CONDITIONAL(附 crux)
```

### 四种 verdict

| verdict | 触发 | 给 founder |
|---|---|---|
| INVEST | 有背书 + 无未解致命 + crux 已解 | 通过 |
| CONDITIONAL | 有背书 + 无未解致命 + crux 仍悬 | 有条件推进,先回答：[crux] |
| PASS(no_conviction) | 无人背书 | 否。没人足够兴奋——温吞的一致看好等于死 |
| PASS(dealbreaker) | 有未回应的致命 | 否。存在没解释掉的死穴：[理由] |

### 边界情况

- 多个致命：任一未 resolved 即走规则 2。
- 弱 champion（will_champion=true 但 conviction 低）：仍算 champion,输出标注"背书信心偏弱"。默认不收紧门槛。
- founder 被传唤：纯函数在讨论后才跑；若 founder 当场答上,host 置 fatal_resolved / crux_resolved = true,函数重跑,可翻转结局。
- **全员 stance=invest 但无人 will_champion → 依然 PASS**（最反直觉、最能体现"不取平均"）。

### 输出结构

```
{
  verdict:     "INVEST" | "CONDITIONAL" | "PASS",
  rationale:   string,
  crux:        string,
  conditions:  string[],   // CONDITIONAL 时
  by_role:     [{role, stance, reason}],
  dissent:     string      // 最强的一条反对
}
```

---

# 3. 董事会（Board）

## 目标

对（假设已投的）公司提出改进计划。定位：让 founder 提前看到"若拿到这笔钱,投资人会怎么审视你"。**产出优先级清单,不出投/不投。** 价值在视角覆盖,不在对抗。

## 组织阶段

- **输入**：Startup 名称、BP、融资币种、估值(可空)、融资规模(可空)、融资轮次。
- **角色选择**：默认 5 人,从池自由选。每个角色带 `risk_axes` 标签,供覆盖检查用。
- **founder**：在场,**可插话**（结构化,见讨论第 2 步）。

## 讨论阶段（4 步,含 Host）

**第 1 步 · 各董事独立提风险与建议（背对背）** — host 只收集。
每位董事在自己 `risk_axes` 领域内,输出**条目列表**,每条：`{建议, 领域(risk_axis), 严重度(1-5)}`。

**第 2 步 · founder 逐条回应** — host 主持。
host 把每条依次抛给 founder,founder 回应三选一：`已在做 / 补充信息 / 未想到`（可附一句 note）。回应记入该条目,影响第 4 步权重。

**第 3 步 · 覆盖检查** — host 独有动作。
host 检查所选董事的 `risk_axes` 并集是否盖住五条轴。缺口则主动补：点名相关董事补充,或直接向 founder 亮出缺口（"这桌没人在管你的钱够不够烧"）。**这是自由选角色的兜底机制。**

**第 4 步 · 收敛成优先级清单** — host 收敛,不裁决。
去重（同轴 + 语义相近合并）→ 按 founder 回应调权 → 排序。

## 结果

### 字段与判定（定死）

每条目结构：

```
BoardItem {
  suggestion:      string
  axis:            risk_axis
  severity:        1-5
  founder_status:  "already_doing" | "added_context" | "unaware" | null
  priority_score:  number   // 计算得出
}
```

优先级计算（确定性）：

```
founder_multiplier = {
  already_doing: 0.3,     // 已在做 → 降级
  added_context: 1.0,     // 补充信息 → host 可据 note 重估 severity 后再算
  unaware:       1.4,     // 未想到 → 升级
  null:          1.0
}
priority_score = severity * founder_multiplier[founder_status]

# 去重：同 axis 且语义相近的条目由 host 合并，severity 取较高者
# 排序：priority_score 降序 = "下一轮就绪度"排序（最挡在与下一轮之间的排最前）
```

覆盖快照：

```
coverage = { [axis]: covered: bool }   // 五条轴各有没有被董事盖到
gaps = axes where covered == false
```

### 输出结构

```
{
  action_list: [   // 按 priority_score 降序
    { suggestion, axis, priority_score, severity, founder_status, rationale }
  ],
  coverage_snapshot: { capital, team, market, growth, product },  // 各 true/false
  gaps: risk_axis[]     // 董事会漏看的轴，对 founder 很有价值
}
```

> 无 verdict。董事会只排序 + 指缺口。

---

# 4. 创始人下午茶（Founder Tea）

## 目标

无特定目标,发散讨论。优化多样性与意外——碰出一个 founder 想不到的角度就值了。**只给线索,绝不给结论。**

## 组织阶段

- **输入**：Startup 名称、BP、融资币种、估值(可空)、融资规模(可空)、融资轮次、可选 topic。
- **角色选择**：默认 5 人,完全自由选（风投家或任意 persona）。这是 Quorum "自由组局"玩法的主场——因为不出任何裁决,角色可彻底自由,不破坏任何逻辑。
- **founder**：在场,**可随时插话**（自由度最高,非结构化）。

## 讨论阶段（含 Host,但 host 近乎隐身）

**开场**：founder 抛一个开放问题/困惑,而非提交材料被评。无标准输入格式,越开放越好。

**主体**：自由发散,允许跑题,**不背对背**——角色互相接话、顺着彼此往下想（与其他模式相反,这里"互相激发"是要的）。

**founder 全程平等参与**：随时能说、追问、带偏话题。

**Host = 催化剂,不收敛**：只做两件轻活——冷场/绕圈时抛一个新角度重新点火；确保各角色都有参与、防霸屏。**绝不把讨论导向结论。**

## 结果

只做**抽取**,不做打分/裁决/排序。host 在结束时抽取四样：

```
{
  theme_map:              string[],   // 一，主题地图：这场主要绕着哪几件事转（非结论）
  surprising_angles:      string[],   // 二，意外角度：founder 大概率没想到的视角（最值钱，放最显眼）
  open_questions:         string[],   // 三，悬而未决的问题（是问题不是任务）
  unresolved_disagreements: [         // 四，分歧留白：如实呈现且不调和
    { point: string, sides: string[] }
  ]
}
```

> **纪律：绝不加"综合建议 / 最终总结 / takeaway"。** 一旦加,下午茶就退化成松散版董事会,四个模式塌成三个。它的价值精确在于"陪你想、但把想清楚留给你自己"。

---

# 5. 附：为什么不取平均（可直接进报告）

VC 收益幂律分布,要的不是"没有短板",而是"有一项极端强"。6/6/6/6/6 与 10/10/5/3/2 平均分同为 6,但真实 VC 选后者。平均分假设"强项补偿弱项",而 VC 世界补偿关系是反的。

现成 eval：把判定函数与两个基线对照——**多数票**会否掉"5 反对 + 1 坚定背书"的非共识好项目,本系统会投；**平均分**会把"全员温吞 invest"排前,本系统判其 no_conviction pass。同一批输入,三法结论不同,即"还原真实 VC 决策逻辑,而非套投票器"的硬证据。

---

# 6. 讨论编排状态机

把每个模式的"讨论过程"定义成可执行的状态机。通用约定：

- 每个状态标注类型：**[LLM]** 一次或多次模型调用 / **[代码]** 确定性逻辑,无模型 / **[UI]** 前端交互,无模型。
- **一次 role 发言 = 一次独立的结构化 LLM 调用**（输出 schema 由该模式定义）。
- host 的"模糊判断"能用代码算的一律用代码算（下面已改写）,只有真正需要理解语义的判断才调用 host（已标注）。
- 每个模式给出**调用预算上限**,超过即强制进入收口,防发散、控成本。n = 所选角色数,默认 5。

## 6.1 初筛会状态机

```
S1 独立打分  [LLM ×n，并行，互不共享上下文]
   每个 role 一次调用 → per_dimension_scores(仅自己 dims) + is_fatal + fatal_reason + will_advance
   ↓
S2 聚合      [代码]
   算 dim_score / 综合分 / 尖刺分 / 分歧度 / 致命标记 / 兴趣标记 / coverage_gaps（见 §1）
   ↓
S3 选分歧点  [代码，无需 host]
   for d in covered: disagreement[d] = max(scores_d) - min(scores_d)
   取 disagreement 最大的、且 ≥ D_min(默认3) 的前 K 个维度（K ≤ 2）
   若无维度达标 → 跳过 S4，直接 S5
   ↓
S4 交锋      [LLM，每个分歧点 2 次]
   对每个分歧维度 d：取该维度打分最高、最低的两个 role
   各一次调用（看到对方分数+理由，回应 ≤80 字）→ rebuttal
   上限：K ≤ 2 个点 → ≤4 次调用
   ↓
S5 crux 收口 [LLM ×1，host]
   host 读全部(分数+交锋) → crux[](2-3个必答问题) + 分歧摘要。不裁决。
   ↓
S6 判定      [代码] decide_screening_outcome() → outcome + route（见 §1）
   ↓
S7 组装输出  [代码]

调用预算：n + ≤4 + 1 ≈ n+5 次
```

## 6.2 投决会状态机

```
S1 表态征集  [LLM ×n，并行]
   每个 role → stance + conviction + will_champion + is_fatal + fatal_reason
   （若本次继承自某初筛 run，可把该 role 的初筛分数作为 prior 注入其上下文，见 §7）
   ↓
S2 选 champion [代码]
   在 will_champion=true 中取 conviction 最高者（并列取 optimist）
   若无人 will_champion → 直接跳 S8（结果必为 PASS/no_conviction）
   ↓
S3 champion 陈述 [LLM ×1] → the case for investing
   ↓
S4 选 dissenter [代码]
   取 stance 最负 / 否则 conviction 最高的反对者 / 否则 stance_tendency=skeptic
   —— 保证无论如何都有一名 dissenter，这是自由选角色不破坏对抗的关键
   ↓
S5 反对陈述  [LLM ×1] dissenter → 最强 kill case + 候选致命点
   ↓
S6 定 crux   [LLM ×1，host] 从 champion+dissent 提炼决定生死的 1-2 个 crux
   ↓
S7 攻防 loop [LLM，≤2 轮]
   每轮：champion 回应 crux(×1) + dissenter 反驳(×1)
   可选 founder 传唤：若 crux 依赖只有 founder 知道的信息，
       host 产出 founder_question → [UI] founder 作答 → 答案注入下一轮上下文
   上限：≤2 轮 → ≤4 次调用（+可选 founder 传唤）
   ↓
S8 host 语义判定 [LLM ×1，host]
   → fatal_resolved + crux + crux_resolved（全流程唯一的语义裁断）
   ↓
S9 判定      [代码] decide_ic_verdict()（见 §2）
   by_role 直接复用 S1 的 stance（除非 founder 传唤改变了结论，则以传唤后为准）
   ↓
S10 组装输出 [代码]

调用预算：n + 1 + 1 + 1 + ≤4 + 1 ≈ n+8 次
```

## 6.3 董事会状态机

```
S1 独立提条目 [LLM ×n，并行，背对背]
   每个 director → items[]，每条 {suggestion, axis(∈自己 risk_axes), severity 1-5}
   ↓
S2 覆盖检查  [代码 + 可选 LLM ×1]
   covered = union(所选 roles 的 risk_axes)；gaps = 五条轴中未覆盖的
   若 gaps 非空 → host 一次调用，把每个缺口措辞成给 founder 的提示
   （只提示缺口，不补内容）
   ↓
S3 founder 逐条回应 [UI，无 LLM]
   前端把所有 item 呈现，founder 每条选 already_doing / added_context / unaware(+可选 note)
   ↓
S4 重估严重度 [LLM ×≤1，host]
   仅对 added_context 的条目，host 依据 note 批量重估 severity；无则跳过
   ↓
S5 收敛      [LLM ×1(去重聚类) + 代码(算分排序)]
   host 一次调用：把同 axis 且语义相近的 item 聚类合并（severity 取较高）
   代码：priority_score = severity × founder_multiplier；按 priority_score 降序
   ↓
S6 组装输出  [代码] action_list + coverage_snapshot + gaps（见 §3）

调用预算：n + ≤1 + ≤1 + 1 ≈ n+3 次（founder 回应是 UI，不计）
```

## 6.4 下午茶状态机

下午茶是唯一的**真·多轮自由讨论**,角色**共享上下文、互相接话**（与其他模式相反）。

```
S1 开场      [UI] founder 抛开放话题 topic（可空则用 BP 起头）
   ↓
S2 讨论 loop [LLM，每轮 1 次，≤ MAX_TURNS(默认 10)]
   每轮：
     a. host [代码/轻LLM] 选下一个发言者：
        - 优先补参与最少的 role（防霸屏，参与次数用代码统计）
        - 每 ROUND_GAP(默认3) 轮检测一次停滞：若近 K 轮语义高度相似 → 置 inject_reframe=true
     b. 若 inject_reframe：host [LLM ×1] 抛一个新角度重新点火
     c. 选中的 role [LLM ×1] 看到近期讨论，接话发言（可发散/跑题）
     d. founder 可随时插话 [UI]：消息插入上下文，下一轮 role 需回应它
   终止：founder 主动结束 或 达到 MAX_TURNS
   ↓
S3 抽取      [LLM ×1，host]
   → theme_map + surprising_angles + open_questions + unresolved_disagreements
   绝不产出结论/建议/takeaway（见 §4）

调用预算：≤ MAX_TURNS + 少量 reframe + 1 抽取
```

> 停滞检测最简实现：对近 K 轮发言做 embedding，两两相似度均值超阈值即判停滞；无 embedding 条件时,退化为"每 ROUND_GAP 轮固定让 host 判一次是否在绕圈"。

---

# 7. 数据流与会话状态

## 7.1 顶层对象

```
Session {                      // 一家公司的一整条评审记录
  id
  company:   CompanyInput      // 共享输入，只填一次
  runs:      ModeRun[]         // 该公司跑过的每个模式的每次执行
  created_at, updated_at
}

CompanyInput {
  name, bp,
  funding_currency,            // 人民币/美元/其他
  valuation?,                  // 可空，带单位
  round_size?,                 // 可空，带单位
  stage,                       // pre-seed | seed | A  → 决定权重列
  topic?                       // 仅下午茶用
}

Panel {                        // 某次 run 选定的评审团
  mode,
  roles: PersonaRef[]          // 引用 persona（功能层+人格层，见单独的 persona spec）
}

ModeRun {
  id, mode,
  panel:     Panel,
  stage:     从 company 带入
  status:    "running" | "done",
  transcript: Turn[],          // 有序讨论记录，供 UI 回放 / 调试
  result:    ScreeningResult | ICResult | BoardResult | TeaResult,
  inherited_from?: run_id,     // 若继承自上游 run（如投决会继承初筛）
  created_at
}

Turn {                         // 讨论过程的一步（用于回放与流式展示）
  seq,                         // 顺序号
  actor:    role_id | "host" | "founder",
  segment:  string,            // 属于状态机哪一步，如 "S4_交锋"
  content:  string,            // 自然语言
  fields?:  object             // 该步的结构化输出（如打分、stance）
}
```

各模式的 `result`（ScreeningResult / ICResult / BoardResult / TeaResult）即 §1–§4 各自定义的输出结构,不重复。

## 7.2 模式间的继承（漏斗）

四个模式**各自可独立运行**,但也能串成 founder 漏斗：下午茶 → 初筛 → 投决会 → 董事会。串联通过 `inherited_from` 实现。

**初筛 → 投决会**（最主要的一条）：

- 初筛 `ScreeningResult.route == "投决会"` 时,UI 提供"进入投决会"入口。
- 点击后创建新的 ICRun,`inherited_from = 该 ScreeningRun.id`,并把以下作为 prior 注入投决会 S1：
  - `crux`（初筛暴露的必答问题）→ 作为投决会的议程起点
  - `by_role`（各 role 的初筛维度分 + 理由）→ 注入对应 role 的上下文,让它带着自己初筛时的判断进场,而非冷启动
  - `will_advance` 信号 → 作为"谁可能是 champion"的先验（但 champion 最终仍由投决会 S2 按 will_champion 重新指派）
- **注意**：继承是"带着记忆进场",不是"复制结论"。投决会仍独立跑完自己的流程、出自己的 verdict。

**其他继承**（可选,优先级低,时间不够可不做）：投决会 INVEST → 董事会（把公司当已投,携带 crux 作为待办来源）；下午茶 → 初筛（把 open_questions 作为初筛的关注点）。

## 7.3 founder 交互数据

- **founder 传唤**（投决会 S7）：`{run_id, question, answer}`,answer 由 [UI] 收集后注入攻防上下文,并可翻转 host 在 S8 的 fatal_resolved / crux_resolved。
- **founder 逐条回应**（董事会 S3）：`{item_id, status: already_doing|added_context|unaware, note?}`,进入 priority_score 计算。
- **founder 插话**（下午茶 S2d）：`{seq, content}`,作为一个 Turn 插入 transcript,下一轮 role 需回应。

## 7.4 状态流转与持久化

- 一次 run 的生命周期：`created(选角色+输入) → running(逐状态推进,每步产生 Turn) → done(result 落库)`。
- **transcript 全程累积**,既供前端流式展示,也供出问题时回放调试。
- Session 以 `company` 为中心,一家公司可挂多个 run（不同模式、或同模式不同评审团的多次尝试）——这天然支持"换一桌人再评一次"的对比,也是 eval 的数据来源。

---

# 附录 A：给工程实现的要点

1. **角色打分统一用 structured output（JSON schema 强制）**,不从自然语言里抠字段。
2. **所有判定函数写成独立纯函数**（decide_screening_outcome / decide_ic_verdict / rank_board_items）,输入结构化字段,输出结果——可单测、可复现,且正好是 eval 对象。
3. **Host 的语义判断最小化**：初筛/投决会仅在收口/攻防后各做一次；董事会仅做去重 + founder 回应分类；下午茶仅做结尾抽取。其余全交确定性代码。
4. **讨论轮次设硬上限**：初筛聚焦≤2 点、投决会攻防≤2 轮,写死在编排里,防发散、控成本。
5. **founder 参与权限按模式区分**：初筛(无)、投决会(仅被传唤)、董事会(结构化逐条回应)、下午茶(自由)。
