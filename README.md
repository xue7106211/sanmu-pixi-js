# sanmu-pixi-js

基于 **Pixi.js v8 + Vite + TypeScript** 的空项目模板。

## 技术栈

- [Pixi.js](https://pixijs.com/) v8 —— 高性能 2D WebGL/WebGPU 渲染引擎
- [Vite](https://vitejs.dev/) —— 现代前端构建工具（开发服务器 + 打包）
- [TypeScript](https://www.typescriptlang.org/) —— 类型安全

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 类型检查 + 生产构建
npm run build

# 预览构建产物
npm run preview
```

## 目录结构

```
.
├── index.html          # HTML 入口
├── src/
│   ├── main.ts         # 程序入口，初始化 Pixi 应用
│   └── vite-env.d.ts   # Vite 类型声明
├── vite.config.ts      # Vite 配置
├── tsconfig.json       # TypeScript 配置
└── package.json
```
