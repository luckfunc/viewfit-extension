[English](README.md) | **简体中文**

# ViewFit 扩展

> **一键切换分辨率，响应式设计从未如此简单。**

专为开发者与设计师打造的视口调整工具。内置丰富预设，支持自定义尺寸，让多端适配测试快人一步。

技术上，ViewFit 是一款 Chrome / Edge（Manifest V3）扩展：将当前浏览器窗口调整到目标视口尺寸，并通过校准尽量接近你设定的宽高。

![ViewFit 预览（中文版商店 Marquee，1400×560）](./docs/images/viewfit-preview.png)

## 功能

- 内置手机 / 平板 / 桌面等常用尺寸预设库
- 自定义预设（保存 / 删除），数据保存在本地
- 后台调整流程（Service Worker），关闭弹窗后仍可继续调整任务
- 自动规范化窗口状态（全屏 / 最大化会先恢复再调整尺寸）
- 校准模式：迭代修正视口
- 当前页面无法获取视口指标时的降级模式

## 架构（当前）

- `src/popup`：界面、预设管理、输入校验与请求下发
- `src/background`：接收调整请求并执行调整任务
- `src/content`：回传视口指标（`innerWidth` / `innerHeight` 等）
- `src/shared`：共享类型、预设与调整核心逻辑

## 开发

```bash
pnpm install
pnpm run lint
pnpm run build
```

常用命令：

- `pnpm run dev` — 监听构建
- `pnpm run lint:fix` — 自动格式化并修复 Lint 问题

## 在浏览器中加载

1. 构建：`pnpm run build`
2. 打开 `chrome://extensions`（或 Edge 对应页面）
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择本仓库的 `dist` 目录
