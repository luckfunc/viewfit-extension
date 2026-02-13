# Viewport Resizer Extension

用于响应式调试的 Chrome/Edge（MV3）扩展。它会按目标尺寸调整**当前浏览器窗口**，并进行一次视口校准。

## 功能

- 设备预设 + 自定义宽高输入
- 遇到最大化/全屏窗口时自动还原后再调整
- 视口校准模式（含一次修正）
- 受限页面自动降级为窗口尺寸模式
- Popup 采用 Geek/GitHub 风格（浅色 + 暗色）

## 开发

```bash
pnpm install
pnpm run build
```

构建后在 Chrome/Edge 里加载 `/dist` 目录即可。

## 字体

Popup 字体从以下路径加载：

- `public/fonts/ibm-plex-sans-var.woff2`
- `public/fonts/jetbrains-mono-var.woff2`

你可以后续直接用自己的字体文件覆盖这两个文件。
