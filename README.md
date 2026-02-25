<div align="center">
  <img src="public/favicon.svg" width="160" height="160" alt="Immersive Clock Logo" />
  <h1>天津二中沉浸式时钟 | Immersive Clock ⏰</h1>


[![](https://img.shields.io/badge/License-GPL--3.0-blue)](LICENSE)
[![](https://img.shields.io/badge/React-18.2.0-61dafb?logo=react)](https://reactjs.org/)
[![](https://img.shields.io/badge/TypeScript-5.4.0-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![](https://img.shields.io/badge/Vite-5.4.0-9135ff?logo=vite)](https://vitejs.dev/)
[![](https://img.shields.io/badge/Electron-39.2.7-9feaf9?logo=electron)](https://www.electronjs.org/)
[![](https://img.shields.io/badge/Platform-Win%20%7C%20Mac%20%7C%20Linux-blue)](https://github.com/QQHKX/immersive-clock/releases)
[![](https://img.shields.io/badge/PWA-enabled-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps/)

**让时间管理更优雅，让学习更专注**

</div>

## 📑 目录


## 🕒 项目概述

**沉浸式时钟（Immersive Clock）** 是一款基于 **React + TypeScript + Vite** 构建的、专为天津二中自习模式设计的轻量化桌面 / 网页时钟应用。  
支持时钟、倒计时、秒表与自习模式，内置天气监测、自习噪音分析、多频道励志语录、多目标倒计时轮播等实用功能。
通过 PWA 技术，支持离线使用、自动更新及桌面端安装体验。

> 适用场景：校园自习、专注学习、番茄钟、演示看板、桌面时钟等。

## 🌠 界面预览

<div align="center">
  <img src="docs/demo/极简界面.jpeg" width="48%" alt="极简界面" />
  <img src="docs/demo/晚自习功能.jpeg" width="48%" alt="晚自习功能" />
</div>

<div align="center">
  <img src="docs/demo/噪音走势图.jpeg" width="80%" alt="噪音走势图" />
</div>

<div align="center">
  <img src="docs/demo/丰富的自习报告.jpeg" width="80%" alt="丰富的自习报告" />
</div>

<div align="center">
  <img src="docs/demo/高帧率采样.jpeg" width="32%" alt="高帧率采样" />
  <img src="docs/demo/丰富的自定义设置.jpeg" width="32%" alt="丰富的自定义设置" />
  <img src="docs/demo/励志语录自定义.jpeg" width="32%" alt="励志语录自定义" />
</div>

<div align="center">
  <img src="docs/demo/友好的新手引导.jpeg" width="48%" alt="友好的新手引导" />
  <img src="docs/demo/公告-更新日志弹窗.jpeg" width="48%" alt="公告-更新日志弹窗" />
</div>

## 🚀 快速使用指南

我们提供多种使用方式，满足不同场景的需求。

### 📱 方式一：PWA 应用安装（强烈推荐）

通过 PWA (Progressive Web App) 技术，您可以像原生应用一样安装本时钟，享受**离线使用**、**桌面图标启动**和**自动更新**的体验，且无需下载庞大的安装包。

**安装步骤：**

1. 使用 Chrome、Edge 等浏览器访问演示站。
2. 点击浏览器地址栏右侧的 **"安装 Immersive Clock"** 图标（通常是一个带有加号的小显示器图标）。
3. 确认安装后，应用将以独立窗口运行，并自动在桌面/开始菜单生成图标。

### 🌐 方式二：浏览器直接使用

如果您不想安装任何内容，可以直接访问网页版。

> 推荐使用 **Chrome**、**Edge** 或 **Safari** 的最新版本以获得最佳性能和动画体验。

### 💻 方式三：Electron 桌面版

如果您需要更传统的桌面软件体验（支持 Windows/macOS/Linux），可以下载 Electron 打包版本。


## 💡 主要功能

### 🧭 时间管理模式

- **多模式切换**：时钟 / 倒计时 / 秒表 / 自习模式一键切换。
- **智能 HUD**：沉浸式交互，点击或按键显示控制栏，无操作约 8 秒自动隐藏。
- **高级倒计时**：
  - 支持单次、高考/考研目标日倒计时。
  - **多事件轮播**：支持添加多个重要日期（如四级、期末考）并按设定间隔自动轮播展示。
  - **个性化定制**：独立配置每个倒计时项的背景色、透明度与字体样式。

### 📚 学习辅助看板

- **环境感知**：
  - **实时天气**：集成天气 API，提供分钟级降水预警与气象灾害预警。
  - **噪音监测**：基于 Web Audio API 的高帧率实时采样，内置评分引擎，支持基线校准、最大阈值设置及包含走势图的详细自习报告。
- **专注氛围**：
  - **励志语录**：支持多频道源（如一言），可配置不同频道的权重与自动刷新频率。
  - **组件开关**：可自由隐藏噪音、语录、大字时间等组件，定制专属学习界面。
  - **背景定制**：支持纯色、径向渐变及上传本地图片作为背景。
  - **个性化字体**：支持上传自定义字体文件 (.ttf/.woff2)，打造舒适的阅读体验。
  - **课表导入**：支持 Excel 课表文件导入，一键同步学习计划。

### 🚀 性能与体验

- **PWA 支持**：离线缓存、桌面安装、自动更新。
- **新手友好**：提供友好的首次使用引导，帮助用户快速熟悉核心功能。
- **资源优化**：静态资源（图片/字体/音频）分级缓存策略，秒级加载。
- **无障碍设计**：全键盘导航支持（Space/Enter 唤出 HUD），优化 ARIA 属性。

## ⏱️ 无障碍与使用说明

详细说明请见：

- [使用说明](docs/usage.zh-CN.md)
- [常见问题 (FAQ)](docs/faq.zh-CN.md)

## 🤝 贡献与开发

如果你想贡献代码、修复问题或在本地进行二次开发，请阅读[贡献指南](CONTRIBUTING.md)。

## 📄 许可证与作者

- 许可证：GPL v3
- 原作者：**QQHKX**
  - 🌐 [个人网站](https://qqhkx.com)
  - 💻 [GitHub](https://github.com/QQHKX)
- 第二作者：**暮至长虹**
