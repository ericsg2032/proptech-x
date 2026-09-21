# Hypit 安装与使用指南（2026-09-21 实测）

> 来源：抖音 @SlashZ「用 Agent 10 秒复刻小Lin说」录屏。视频里演示的开源项目是 **Hypit**，
> GitHub 仓库 <https://github.com/hypit-ai/hypit>，官网 <https://hypit.ai>。
> 本文所有命令都在 Ubuntu 24.04 + Node 22.22 + pnpm 10.33 的干净环境里跑通过。

## 1. 这是什么项目

Hypit 的一句话定位：**"Clone any viral video with AI agents"（让 AI Agent 复刻任何爆款视频）**。

它不是一个生图或生视频的模型，也不是一个独立的 Agent。视频作者在片中说得很准："它其实不是一个 agent 或者是直接生图的一套工具"。
它是给 Claude Code、Codex 这类**编程 Agent** 准备的一整套「做视频的语言 + 工具」：

- **一套语言 SVML**：用 XML 风格的文件描述一条视频。剧本、画面、字幕、B-roll、动效全部**锚定在"词"上而不是"秒"上**。
  改一句台词，时间轴自己重排；换主播不用碰字幕。
- **一个命令行 `hypit`**：检查源文件、生成素材、渲染成片、管理结果。
- **一个浏览器界面 Studio**：看时间线、改组件参数、在具体时间点写批注。
- **一个 Skill `/hypit`**：装进 Claude Code / Codex 后，Agent 就会按 Hypit 的制作流程干活：
  看参考视频、逐帧分析、转写台词、写 Brief / Treatment、写 SVML、报价、生成、渲染、打开 Studio 给你看。

生成模型是可插拔的（Seedance、Seedream、GPT Image、Nano Banana、Fish Audio、WhisperX……），
走你自己的 API key 或者官方托管的 HypiHub 账号。**纯代码渲染的视频可以 0 成本**，只用本地 Chrome + FFmpeg。

| 项目信息 | 值 |
| --- | --- |
| 仓库 | `hypit-ai/hypit`（搜索结果里其他同名仓库都是 fork） |
| 版本 | 0.2.12（2026-09-21 main 分支） |
| 语言 | TypeScript 98%，pnpm monorepo，138 个 workspace 包 |
| 要求 | Node.js ≥ 22.15，pnpm 10.33（源码方式），FFmpeg / FFprobe |
| 许可证 | Apache-2.0 with conditions（Hypit 开源许可：产出的视频归你，第三方模型服务另有条款） |
| 社区 | Discord、Telegram、X @hypitai、微信群（README.zh-CN.md 里有二维码） |

视频里演示的效果：左边是「小Lin说」原片，右边是复刻版（1280×720、30fps），同一张「亚洲各国 GDP 增速」折线图由代码渲染出来，主播换成了作者自己。
仓库里的 `examples/complex-explainer` 就是一个类似的 137 秒中文讲解视频完整工程（17 段口播 + 8 个代码动画场景），可以下载素材包在 Studio 里打开学习。

## 2. 先搞清三个独立的部分

装错的常见原因是把这三样混在一起。它们各自安装、各自更新：

| 部分 | 作用 | 安装方式 |
| --- | --- | --- |
| Hypit Skill | 给 Agent 的制作知识（`/hypit` 命令） | `npx skills add hypit-ai/hypit -g` |
| 可执行程序 `@hypit/hypit` | `hypit` CLI、Studio、本地 Runtime | `npm install --global @hypit/hypit` |
| 你的视频项目 | `.svml` / `.svs` / `.svrun`、素材、渲染结果 | 任意空目录，不需要克隆仓库 |

装了 Skill 不等于装了程序；装了程序也不带任何模型额度。

## 3. 安装（macOS 为主，Windows 备注）

### 3.1 前置条件

```bash
# macOS
brew install node@22 ffmpeg     # Node ≥ 22.15；FFmpeg 带 ffprobe
brew install uv                 # 可选：本地 WhisperX 转写、yt-dlp 下载视频 需要 Python 3.10–3.13 + uv
node --version && ffmpeg -version | head -1 && ffprobe -version | head -1
```

```powershell
# Windows
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Gyan.FFmpeg.Shared -e
winget install --id astral-sh.uv -e
```

### 3.2 安装 Skill（给 Claude Code / Codex）

```bash
npx skills add hypit-ai/hypit -g
```

实测输出：Skill 装到 `~/.agents/skills/hypit`，并软链到 `~/.claude/skills/hypit`，Claude Code 里就能用 `/hypit`。
最后一行 "PromptScript does not support global skill installation" 可以忽略，那是 skills CLI 对另一种 Agent 的提示。

### 3.3 安装可执行程序

```bash
npm install --global @hypit/hypit
hypit --version          # 应输出 0.2.x
hypit version --check    # 对比 npm 上的最新版
```

### 3.4 初始化项目并准备本地渲染环境（首次一次）

```bash
mkdir my-video && cd my-video
hypit runtime init       # 写出 hypit.runtime.json：HypiHub 托管 + 本地 media + 本地 hyperframes
hypit runtime up         # 安装上游包到 ~/.local/state/hypit/packages，下载 Chrome Headless Shell 152，启动 Worker
hypit doctor             # 全绿即可
```

`runtime up` 会从 Google 官方源下载 Chrome for Testing 的 headless shell（约 100 多 MB），放在 `~/.cache/hyperframes/chrome`。
如果下载被墙，可以在 `hypit.runtime.json` 的 `hyperframes.local.config` 里设置 `browserDownloadBaseUrl` 指向镜像，
或者 `chromePath` 指向本机已有的 Chrome/Chromium 可执行文件。

## 4. 第一次使用：三条路

### 路线 A：零成本验证安装（不需要任何 API key）

这是我实测跑通的路线，用仓库自带的 8 秒聊天气泡动画示例：

```bash
git clone --depth 1 https://github.com/hypit-ai/hypit
cd hypit
pnpm install --frozen-lockfile              # 实测 6.8 秒；pnpm 10 会拦截依赖的 postinstall 脚本，这是正常的
pnpm build:public-types                     # 实测 32 秒
pnpm --filter @example/chat-scene build     # 编译示例组件

cd examples/semantic-composition
node ../../bin/hypit.mjs runtime use hypit.runtime.json --workspace .
node ../../bin/hypit.mjs runtime up --workspace .        # 首次下载浏览器
node ../../bin/hypit.mjs check chat.svml --workspace .   # ✓ Source is valid
node ../../bin/hypit.mjs plan chat.svrun --workspace .   # 3 个本地请求，0 费用
node ../../bin/hypit.mjs build chat.svrun --workspace . --follow
node ../../bin/hypit.mjs get <build-id> --output final.video --workspace . --to output/final.mp4
node ../../bin/hypit.mjs studio --run chat.svrun --workspace .   # 打开 http://localhost:5179/
```

实测结果：渲染 21 秒，得到 540×960、30fps、8 秒、H.264 + AAC 的 mp4，Studio 4 秒内可访问。
（在仓库内用 `node ../../bin/hypit.mjs`；全局安装了 `@hypit/hypit` 之后直接写 `hypit` 即可。）

### 路线 B：在 Claude Code 里用 `/hypit` 复刻一条视频（视频里演示的方式）

```bash
mkdir my-video && cd my-video
claude
```

然后在 Claude Code 里输入：

```text
/hypit 参考这个视频：/path/to/video.mp4。
把主播换成我（照片在 ./assets/me.jpg），产品换成 XXX，保留开头的抓人方式和图表呈现。
```

Agent 会按顺序做这些事，并在每一步跟你说明：

1. 检查环境（`hypit doctor`），缺什么工具会告诉你怎么装。
2. 用 `hypit media probe / frames / tile` 逐帧看参考视频；有对白就用 WhisperX 转写（本地或 HypiHub 托管）。
3. 把分析写进项目文件（reference notes、Brief、Treatment）。
4. 写 `.svml` 剧本与合成、`.svs` 样式、`.svrun` 执行计划。
5. **付费前先报价**（`hypit pricing xxx.svrun`），说明用哪个账号、生成什么、预计多少钱，等你确认。
6. `hypit build --follow` 生成素材并渲染，然后打开 Studio 给你看，你可以在 Comments 里打时间点批注。

参考视频是抖音 / B 站 / YouTube 链接时：

```bash
hypit media prepare-fetch                                  # 首次准备 yt-dlp 环境（需要 uv）
hypit media fetch "https://v.douyin.com/xxxx/" --to refs/source.mp4
```

具体平台是否支持取决于 yt-dlp；不行就用平台自己的下载功能拿到 mp4 文件。

### 路线 C：没有参考视频，直接描述

```text
/hypit 做一个 ranking 视频，把 Hypit 排到 S 级。
```

## 5. 模型服务与费用

- Hypit 本身免费、不加水印、不按渲染次数收费。费用来自两处：你的 Coding Agent（如 Claude Code 订阅）和生成模型服务。
- **推荐路径 HypiHub**（官方托管，一个账号搞定图片、视频、语音、WhisperX）：

  ```bash
  hypit auth status hypihub.default    # 实测：apiKey missing，login 会打开 https://hypit.ai/oauth/consent
  hypit auth login hypihub.default
  ```

- **自带 key**：发行包内置了这些 Provider，对国内用户比较友好：

  | Provider | 覆盖的模型 |
  | --- | --- |
  | TokenDance | Seedance 2.0 / 2.5、Seedream 5.0 lite、MiniMax H3 |
  | HiAPI | Seedance、Seedream、MiniMax H3、GPT Image 2、Nano Banana、Grok Imagine |
  | Pollo | MiniMax H3、Grok Imagine 1.5、GPT Image 2、Nano Banana |
  | BeatAPI | Seedance 2.0 / 2.5、MiniMax H3、Grok Imagine 1.5、GPT Image 2、Nano Banana |
  | Monid | Seedance 2.0 / 2.5、MiniMax H3、Wan 2.7 |

  语音：Fish Audio、ElevenLabs、MiMo。转写：WhisperX（本地需 Python + uv，或 HypiHub 托管）。
  把 key 属于哪个服务、接口文档链接告诉 Agent，它会改 `hypit.runtime.json` 并用 `hypit auth login <endpoint>` 存凭据。
- 官方示例成本参考：20 秒足球 tier list（2 段 Seedance 口播 + 11 张 GPT Image 图 + WhisperX 对齐）**$1.15**；
  18 秒播客 $1.07；26 秒街访 $1.09。
- 评论区有人问「用这个 skill 做分镜然后丢给豆包用 Seedance 2.0 吗？」。答案是：Hypit 自己就直接调 Seedance 的 API，
  不需要手动去豆包；但你得有一个能提供 Seedance 的账号（上表任意一家或 HypiHub）。

## 6. 项目结构与核心概念

```text
my-video/
  authors/main.svml         Author Source：<script> 剧本、素材声明、组件、合成、渲染
  recipes/*.svs             Recipes：外观、动效、生成参数的可复用配方
  runs/final.svrun          Run Source：这次要产出什么（target），复用哪些旧结果（build-record + satisfy）
  assets/                   你提供的照片、产品图、音乐
  packages/                 项目自己写的组件（HTML/CSS/SVG/JS 渲染的图表、场景）
  output/                   显式导出的成片
  hypit.runtime.json        Runtime Profile：本地 / 托管端点 + 凭据存储
  .hypit/results/<日期>/<build-id>/   每次 build 的结果、日志、产物（加进 .gitignore）
```

三个关键理念：

- **锚定在词上**：剧本里 `@{greek-god} a Greek god @{/greek-god}` 这样的标记就是 B-roll、动效的触发点，
  改词之后所有跟着它的画面自动重排。
- **显式复用，没有隐藏缓存**：每次 `build` 都是新 id；要复用上次生成的口播片段，得在 `.svrun` 里写
  `<build-record>` + `<satisfy>`。这样不会偷偷重复花钱，也不会偷偷用旧素材。
- **Studio 是编辑器不是渲染器**：时间线、Inspector 改参数、Comments 批注（存到 `FEEDBACK.json`，Agent 会读），
  成片仍然要 `hypit build`。

## 7. 常用命令速查

| 目的 | 命令 |
| --- | --- |
| 校验源文件 | `hypit check main.svml` |
| 看这次会做什么、要不要花钱 | `hypit plan final.svrun`、`hypit pricing final.svrun` |
| 提交并跟随进度 | `hypit build final.svrun --follow` |
| 列出 / 查看 / 导出结果 | `hypit builds`、`hypit inspect <id>`、`hypit get <id> --output final.video --to output/final.mp4` |
| 看执行日志 | `hypit logs <id>` |
| 本地环境 | `hypit doctor`、`hypit runtime up` / `status` / `logs` / `down`、`hypit paths` |
| 凭据 | `hypit auth status` / `login` / `logout <endpoint>` |
| 分析参考视频 | `hypit media probe` / `frames` / `tile` / `cut <file>`、`hypit media fetch <url> --to x.mp4` |
| 打开 Studio | `hypit studio --run final.svrun`（默认端口 5179，`#comments` 是批注视图） |

## 8. 实测记录与注意事项

- 环境：Ubuntu 24.04、Node 22.22.2、pnpm 10.33.0、FFmpeg 6.1。仓库 `.node-version` 写的是 24.14.1，
  但 `engines` 要求 ≥ 22.15，22 LTS 实测可用。
- `pnpm install` 时的 "cyclic workspace dependencies" 警告和 "ignored build scripts" 提示都是正常的。
- `hypit runtime up` 会在机器目录安装 `@hyperframes/engine`、`@hyperframes/producer` 等上游包并下载浏览器，第一次比较久。
- 这次实验是在临时云沙箱里做的，会话结束环境就没了。要在自己电脑上用，按第 3 节重装一遍即可，10 分钟以内。
- 版权提醒：README 写明「你创作的视频归你，第三方模型与服务另有条款」。直接复刻像「小Lin说」这样有明确作者的内容，
  发布前要考虑版权和平台规则；评论区也有人担心这类工具会让高质量内容被 AI 仿制。用别人的视频做「结构参考」、
  换成自己的内容和素材，是这个工具设计上的用法。

## 9. 相关链接

- 仓库：<https://github.com/hypit-ai/hypit>（中文 README：`README.zh-CN.md`；中文文档：`docs/zh/`）
- 官网 / 演示：<https://hypit.ai>；快速开始：<https://hypit.ai/zh/quickstart/>
- Skills CLI：<https://github.com/vercel-labs/skills>
- 官方示例：`examples/ranking-football`（UGC 排行榜）、`examples/podcast`、`examples/interview`、
  `examples/complex-explainer`（中文讲解视频）、`examples/semantic-composition`（零成本代码动画）
