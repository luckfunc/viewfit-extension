# Viewport Resizer Extension

一个用于响应式调试的 Chrome/Edge（MV3）扩展。它会把当前浏览器窗口调整到目标视口尺寸，并执行校准流程以尽量接近目标值。

## 功能

- 内置移动端/平板/桌面预设库
- 支持自定义预设（保存/删除），并本地持久化
- 使用 Background Service Worker 执行 resize：即使 popup 关闭也可继续执行
- 自动处理窗口状态（全屏/最大化时先恢复再调整）
- 校准模式：多轮迭代修正视口尺寸
- 降级模式：当前页面无法获取视口指标时回退为窗口尺寸调整

## 当前架构

- `src/popup`：UI、预设管理、输入校验、请求发送
- `src/background`：接收 resize 请求并执行任务
- `src/content`：返回视口指标（`innerWidth/innerHeight`）
- `src/shared`：共享类型、预设、核心 resize 逻辑

## 开发

```bash
pnpm install
pnpm run lint
pnpm run build
```

常用命令：

- `pnpm run dev` - 监听并持续构建
- `pnpm run lint:fix` - 自动格式化并修复 lint 问题

## 浏览器加载方式

1. 先构建：`pnpm run build`
2. 打开 `chrome://extensions`（Edge 同理）
3. 开启 `Developer mode`
4. 点击 `Load unpacked`
5. 选择 `dist` 目录

## 字体

Popup 使用以下字体文件：

- `public/fonts/ibm-plex-sans-var.woff2`
- `public/fonts/jetbrains-mono-var.woff2`

可以直接替换为你自己的字体文件。
