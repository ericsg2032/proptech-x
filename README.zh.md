# PropTech-X — MVP

面向澳大利亚市场的 AI 房产顾问。输入一个地址,即可在几秒内得到对同一套房子的**双视角**解读:**自住(owner-occupier)** vs **投资(investor)**,并排呈现在一页里。

这是一个精简、可直接运行的 MVP 脚手架。**零 API 密钥即可启动**,用贴近真实的 mock 数据跑通整个流程,之后再逐个接入真实数据源。

```bash
npm install
npm run dev
# 打开 http://localhost:3000
```

---

## 相比原始蓝图改了什么(以及为什么)

原始蓝图让 agent 通过语义搜索 API 去**爬 `realestate.com.au` / `domain.com.au`**,以此省下买房产数据的钱。这有三个问题:违反这两个站点的服务条款(REA 会追究)、抓到的数据质量低于官方源,而且**完全没必要**。因此内置了两处纠正:

1. **结构化房产数据 → Domain 官方 API**(`src/lib/domain.ts`)。
   免费 "innovation" 层,提供挂牌、可比成交、suburb 表现、AVM(估值)与租金——合法且全国覆盖。语义搜索(`src/lib/research.ts`)保留,但**只用于真正公开的长尾内容**(council 新闻、学校信息、suburb 概况),绝不用于挂牌/成交数据。

2. **财务计算在代码里完成,不交给大模型**(`src/lib/cashflow.ts`)。
   毛收益率、三年现金流、负扣税(negative gearing)都是确定性、可审计的。大模型只负责*定性*部分(优缺点、规划白话解读、文字叙述)。

此外:它是**全澳的,不锁单州**。除法定规划外,其余数据(Domain + Maps + ABS)本来就全国覆盖。规划是唯一按州割裂的层,所以 `src/lib/planning.ts` 从地址判定州,路由到该州官方源(VicPlan、NSW Spatial Viewer、QLD SPP/DAMS、SA SAPPA、WA、TAS PlanBuild、NT、ACT),并全部归一化成一个 `PlanningSnapshot` 结构。

---

## 架构

```
/onboarding  ── 收集地址 + 意图 ──▶ sessionStorage
/dashboard   ── POST /api/evaluate ──▶ thinking-tree 加载动画 ──▶ 双视角报告

/api/evaluate 编排流程:
  geocode (Maps) → Domain(房产、可比成交、suburb 统计、AVM、租金)
                 → planning(按州归一化)
                 → 公开研究(Exa/Tavily,仅长尾)
                 → cashflow.ts(确定性数字)
                 → llm.ts(仅文字)  → EvaluationReport
```

## 接入真实数据(每层独立,未填则走 mock)

把 `.env.local.example` 复制成 `.env.local`,拿到 key 就逐个填:

| 层 | 环境变量 | 在哪申请 |
|---|---|---|
| 大模型(仅文字) | `ANTHROPIC_API_KEY` **或** `GEMINI_API_KEY` + `LLM_PROVIDER` | Anthropic / Google AI Studio |
| 房产数据 | `DOMAIN_CLIENT_ID`、`DOMAIN_CLIENT_SECRET` | developer.domain.com.au |
| 地理编码 + 通勤 | `GOOGLE_MAPS_API_KEY` | Google Maps Platform |
| 公开研究 | `EXA_API_KEY` 或 `TAVILY_API_KEY` | exa.ai / tavily.com |

`src/lib/domain.ts` 和 `src/lib/planning.ts` 里已经把真实 endpoint 用 `TODO` 标好了——拿到 key 后,把响应解析补全即可。

**Domain 上线条款:**需展示 "Powered by Domain"、链接回原始挂牌页、且不得长期存储 Listings 数据。

---

## 在 Claude Code 里继续迭代

如果你用 Claude Code 迭代,请把包里的
[`CLAUDE_CODE_PROMPT.md`](./CLAUDE_CODE_PROMPT.md) 投喂给它,**别再用那份爬虫版蓝图**。

## 免责声明

仅供一般性参考——不构成财务、法律或税务建议。所有数字均为指示性测算,行动前请咨询持牌专业人士。(在澳洲,提供个性化的财务/信贷/税务建议可能需要 AFSL/ACL/TPB 牌照——请将产品定位为"信息研究工具"。)
