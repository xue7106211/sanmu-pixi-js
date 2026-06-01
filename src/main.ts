import { Application } from "pixi.js";
import { LoadingScene } from "./scenes/LoadingScene";

/**
 * 入口文件（最顶层）—— 分层架构的根：
 *   main(入口) → LoadingScene(场景) → 各 Component(组件)
 *
 * 职责：
 *  1. 创建并初始化 PixiJS Application（舞台 + 渲染器 + ticker）
 *  2. 把 canvas 挂到 DOM
 *  3. 实例化场景、加入 stage、做首次布局
 *  4. 接管窗口 resize 与每帧 update
 */
async function bootstrap(): Promise<void> {
  // 1. 创建应用（Pixi v8 采用异步初始化）
  const app = new Application();
  await app.init({
    background: "#000000", // 设计稿为纯黑背景
    resizeTo: window, // 窗口自适配：画布尺寸跟随浏览器窗口
    antialias: true, // 抗锯齿，让矢量星星边缘更平滑
    resolution: window.devicePixelRatio || 1, // 适配高分屏（Retina）
    autoDensity: true, // 配合 resolution，自动校正 CSS 尺寸避免模糊
  });

  // 2. 把 Pixi 生成的 canvas 挂到页面挂载点
  const root = document.getElementById("app");
  if (!root) {
    throw new Error("未找到挂载节点 #app");
  }
  root.appendChild(app.canvas);

  // 3. 实例化加载场景，加入舞台（stage 是整棵显示树的根节点）
  const scene = new LoadingScene();
  app.stage.addChild(scene);

  // 首次布局：按当前画布逻辑尺寸居中
  scene.layout(app.screen.width, app.screen.height);

  // 4. 监听窗口变化，重新居中布局
  window.addEventListener("resize", () => {
    scene.layout(app.screen.width, app.screen.height);
  });

  // 5. 主循环：每帧把时间增量传给场景，驱动进度与动画
  app.ticker.add((ticker) => {
    scene.update(ticker.deltaTime);
  });
}

bootstrap();
