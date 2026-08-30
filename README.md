# SJTU jAccount 验证码助手

[![CI](https://github.com/tombirdQAQ/SJTU-Login-Addon/actions/workflows/ci.yml/badge.svg)](https://github.com/tombirdQAQ/SJTU-Login-Addon/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/tombirdQAQ/SJTU-Login-Addon)](https://github.com/tombirdQAQ/SJTU-Login-Addon/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

你是否不胜 jAccount 频繁登录还要输验证码的烦扰？这个适用于 Edge/Chrome/Firefox 的 Manifest V3 扩展正适合你：打开 SJTU jAccount 登录页后，扩展在**浏览器本地**识别并填写验证码，无需任何第三方服务。搭配可选的"自动登录"功能，可以做到打开登录页即完成登录。

产品官网：<https://jaccount.sj-tu.com>

## 功能特性

- **本地验证码识别**：内置 ddddocr 的 ONNX 模型，通过 onnxruntime-web（WASM）在浏览器内推理，验证码图片不离开本机
- **自动填写**：监测登录页验证码出现或刷新，识别后自动填入输入框
- **可选自动登录**：默认关闭；开启后可将 jAccount 账号密码经 AES-GCM 加密保存在本机，登录页加载后自动填充并提交
- **克制的提交策略**：仅当用户名、密码、验证码全部就绪时才延迟 500 ms 点击登录；每次页面加载最多自动尝试 3 次
- **最小权限**：只申请 `storage` 权限和 `jaccount.sjtu.edu.cn` 的站点权限
- **跨浏览器**：同一份源码构建出 Chromium（Service Worker）与 Firefox（事件页）两个包，清单由 `scripts/manifest.mjs` 统一派生，版本与权限不会漂移

## 安装

### 方式一：从 Edge 外接程序商店安装（推荐）

已上架 Microsoft Edge 商店，一键安装、自动更新：

**[SJTU jAccount 验证码助手 - Microsoft Edge Addons](https://microsoftedge.microsoft.com/addons/detail/sjtu-jaccount-%E9%AA%8C%E8%AF%81%E7%A0%81%E5%8A%A9%E6%89%8B/dgjpildobjblobjjfnbeonlemoghgcmh)**

### 方式二：从 Release 下载

1. 在 [Releases](https://github.com/tombirdQAQ/SJTU-Login-Addon/releases/latest) 下载最新的 `SJTU-Autologin-<version>.zip` 并解压。
2. Edge 打开 `edge://extensions`，Chrome 打开 `chrome://extensions`。
3. 开启"开发人员模式"。
4. 点击"加载解压缩的扩展"，选择解压后的目录。

> Release 同时提供签名的 `.crx` 文件和 `SHA256SUMS.txt` 校验和。注意 Windows/macOS 上的 Chrome 默认禁止安装商店外的 `.crx`（Linux 开发者模式可用），普通用户请使用 ZIP 方式。

### 方式三：Firefox

Firefox 需要 **115 ESR 或更高版本**，安装 `SJTU-Autologin-firefox-<version>.zip`：

- **临时载入（开发/自测）**：打开 `about:debugging#/runtime/this-firefox` →「临时载入附加组件」→ 选择 ZIP 包或 `dist/firefox/manifest.json`。重启浏览器后失效。
- **永久安装**：需要 AMO 签名后的 `.xpi`。未签名的包只能装在 Firefox Developer Edition / Nightly，并需将 `about:config` 的 `xpinstall.signatures.required` 设为 `false`。

> **首次安装后请确认站点授权。** Firefox 把 MV3 的站点权限视为可选授权，Firefox 127 以下的版本在安装时甚至不会提示。若扩展弹窗顶部出现「尚未授权访问 jaccount.sjtu.edu.cn」，点击「授权访问」并刷新登录页即可。

### 方式四：从源码构建

见下方[开发](#开发)一节，构建产物在 `dist/chromium/` 与 `dist/firefox/` 目录，同样用"加载解压缩的扩展"载入。

> Chrome Web Store 暂未上架。上架所需的文案、截图与数据披露清单见
> [docs/STORE_LISTING.md](docs/STORE_LISTING.md)。

## 使用方法

1. 安装后点击工具栏扩展图标，等待状态显示"本地 OCR 模型已就绪"（首次加载模型需几秒）。
2. "自动填写验证码"默认开启，打开 jAccount 登录页即生效。
3. 如需自动登录：打开"自动登录"开关，填入 jAccount 账号密码并点击"加密保存到本机"。之后打开登录页会自动填充账号、识别验证码并提交。
4. 随时可在弹窗中点击"清除"删除已保存的凭据。

## 工作原理

```
登录页 (content.js)                 后台 (background.js)
┌─────────────────────┐            ┌──────────────────────────────┐
│ 监测验证码 <img>     │──图片 PNG──▶│ ocr.js: onnxruntime-web WASM │
│ 填入识别结果          │◀──识别文本──│  + common.onnx + CTC 解码    │
│ 自动登录门控          │──取凭据────▶│ credentials.js: AES-GCM      │
│ (500ms 延迟/限 3 次) │◀──解密凭据──│  加解密 storage.local        │
└─────────────────────┘            └──────────────────────────────┘
                                   Chromium: Service Worker
                                   Firefox:  事件页 (event page)
```

- `content.js` 通过多组选择器定位密码登录表单的验证码图片与输入框（刻意排除短信登录和图标），用 canvas 将图片转为 PNG 后发给后台。
- `ocr.js` 用 onnxruntime-web 的单线程 WASM 后端运行 `assets/common.onnx`（ddddocr beta 模型），输出经 `ctc.js` 做 CTC 贪心解码得到文本。
- 自动登录由 `auto-login.js` 的提交门控管理：凭据填充完成 + 验证码识别完成 → 延迟 `500 ms` 提交，每页最多 `3` 次，避免识别错误时无限循环。
- 凭据经 Web Crypto 的 AES-GCM（256 位）加密后存入 `storage.local`；密钥是**不可导出**的 CryptoKey，单独存于扩展的 IndexedDB。后台校验消息来源，仅扩展自身页面可读写凭据、仅 jAccount 登录页的内容脚本可取用。

## 隐私与安全

- 扩展不读取、不上传网页内用户输入的任何信息；验证码图片只在当前浏览器中处理。
- 自动登录为可选功能，凭据加密保存在本机，清除按钮会同时删除密文和密钥。
- 构建和测试都会校验内置模型 `common.onnx` 的 SHA-256，防止资产被篡改。
- 完整隐私政策见 [PRIVACY.md](PRIVACY.md)；漏洞报告流程见 [SECURITY.md](SECURITY.md)。

## 开发

需要 Node.js 18 或更高版本：

```powershell
npm install
npm run check         # 运行测试
npm run build         # 构建 dist/chromium 与 dist/firefox
npm run build:firefox # 只构建其中一个目标（另有 build:chromium）
npm run lint:firefox  # 用 web-ext 按 AMO 规则校验 Firefox 包
npm run package       # 构建并打包 release/ 下的两个 ZIP
```

构建会先校验内置 `common.onnx` 的 SHA-256，再用 esbuild 打包三个入口（`background.js`、`content.js`、`popup.js`）并复制静态资源，分别输出到 `dist/chromium/` 和 `dist/firefox/`。修改代码后重新执行 `npm run build`，在扩展管理页点击"重新加载"。

### 跨浏览器实现要点

`extension/manifest.json` 是唯一的清单来源（Chromium 形态），Firefox 清单由 `scripts/manifest.mjs` 在构建时派生，因此版本号、权限、CSP 与匹配规则不可能在两个包之间漂移。两者的差异只有这些：

| | Chromium | Firefox |
| --- | --- | --- |
| 后台 | `service_worker` + ES module | `background.scripts` 事件页 + IIFE 包 |
| 打包格式 | esbuild `esm` / `chrome103` | esbuild `iife` / `firefox115` |
| 附加清单键 | `minimum_chrome_version` | `browser_specific_settings.gecko`（ID、`strict_min_version`、`data_collection_permissions`） |
| 站点权限 | 安装时授予 | 用户可选授予，弹窗内提供授权按钮 |

- **API 命名空间**：`extension/browser-api.js` 统一导出 `globalThis.browser ?? globalThis.chrome`。Firefox 的 `chrome.*` 是回调式的，只有 `browser.*` 返回 Promise，而 Chromium MV3 的 `chrome.*` 也返回 Promise，因此优先取 `browser` 就能在两端得到同一套 Promise 接口，无需引入 polyfill。测试会拦截任何漏改的裸 `chrome.` 调用。
- **内容脚本的 Xray vision**：Firefox 给内容脚本的是页面元素的 Xray 视图，往 `element.dataset` 上写的值会落在每个沙箱各自的包装对象上，**既不产生真实的 `data-*` 属性，也读不回来**。验证码识别状态原先就存在 `dataset` 上，导致 Firefox 上验证码能填、账号密码能填，唯独自动登录的门控永远不放行。现改用 `setAttribute` / `getAttribute`，属性能跨越该边界。测试会拦截 `dataset` 在内容脚本里的回归。
- **ORT wasm 路径**：Firefox 事件页的 base URL 是浏览器生成的后台文档，onnxruntime-web 无法据此推断 `.wasm` 位置，所以 `ocr.js` 显式指定 `ort.env.wasm.wasmPaths = { wasm: ... }`。这里必须用对象形式：字符串会被当作目录前缀，导致 ORT 连带去找并未随包发布的 `.mjs` 胶水文件。

### 上架 Firefox（AMO）

1. `npm run package` 后取 `release/SJTU-Autologin-firefox-<version>.zip`。
2. `npm run lint:firefox` 应为 **0 errors**。当前有 3 条已知 warning，均不阻塞审核：
   - 两条 `KEY_FIREFOX*_UNSUPPORTED_BY_MIN_VERSION`——`data_collection_permissions` 是 AMO 对新扩展的必填键，但它要到 Firefox 140 才被识别。保留 `strict_min_version: 115.0` 意味着老版本会忽略该键，这是支持 115 ESR 的代价。
   - 一条 `UNSAFE_VAR_ASSIGNMENT`——来自 onnxruntime-web 内部的动态 `import()`，属上游实现。
3. 提交的包内 JS 是 esbuild 压缩产物，**AMO 要求同时提交源码与构建说明**：源码仓库地址 + Node.js 22 + `npm ci && npm run build:firefox`，产物目录 `dist/firefox`。

### 测试

```powershell
npm run check
```

测试包含 CTC 解码、自动登录门控、清单与发布资源审计。`tests/fixtures/jaccount-captcha.png` 是匿名获取的固定测试验证码；Python `ddddocr(beta=True)` 和浏览器 WASM 的参考结果均为 `bsbsk`。`tests/browser-harness.html` 可在浏览器中手动验证 WASM 推理结果。

## 许可证

本项目源码以 [MIT 许可证](LICENSE) 开源，版权所有 © 2026 sj-tu.com。

内置的验证码识别模型（`common.onnx`，源自 ddddocr）及 onnxruntime-web 等运行时依赖遵循各自的许可证，详见 [THIRD_PARTY_NOTICES.txt](extension/THIRD_PARTY_NOTICES.txt)。
