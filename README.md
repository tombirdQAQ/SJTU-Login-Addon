# SJTU jAccount 验证码助手

适用于 Edge/Chrome 的 Manifest V3 扩展。打开 SJTU jAccount 登录页后，扩展会在浏览器本地识别并填写验证码。

- 不需要 Python、本机服务或网络 OCR API。
- 不读取、保存或提交用户名和密码。
- 不自动点击登录，提交前可人工检查结果。
- 模型与 WebAssembly 运行时全部包含在扩展包中。

弹窗中可单独开启“自动登录”。该功能默认关闭；开启后，仅当浏览器
已经填充用户名和密码、验证码也识别完成时，扩展才会延迟 500 ms
点击页面原生登录按钮。每次页面加载最多自动尝试三次。

## 构建

需要 Node.js 18 或更高版本：

```powershell
npm install
npm run check
npm run build
```

构建会校验内置 `common.onnx` 的 SHA-256，然后生成 `dist`。

## 本地安装

1. Edge 打开 `edge://extensions`，Chrome 打开 `chrome://extensions`。
2. 开启“开发人员模式”。
3. 点击“加载解压缩的扩展”，选择本项目的 `dist` 目录。
4. 点击扩展图标，等待状态显示“本地 OCR 模型已就绪”。
5. 按需开启“自动登录”。
6. 打开 SJTU jAccount 登录流程。验证码出现或刷新后会自动填写。

修改代码后重新执行 `npm run build`，再在扩展管理页点击“重新加载”。

## 发布包

```powershell
npm run package
```

发布 ZIP 输出到 `release/sjtu-jaccount-captcha-<version>.zip`，清单位于 ZIP 根目录。

## 测试

```powershell
npm run check
```

测试包含 CTC 解码、清单与发布资源审计。`tests/fixtures/jaccount-captcha.png` 是匿名获取的固定测试验证码；Python `ddddocr(beta=True)` 和浏览器 WASM 的参考结果均为 `bsbsk`。

## 隐私与许可

验证码图片只在当前浏览器中处理，不会上传到外部服务。第三方模型和运行时许可见 `THIRD_PARTY_NOTICES.txt`。
