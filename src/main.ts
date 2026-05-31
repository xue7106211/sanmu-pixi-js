import { Application, Graphics } from "pixi.js";

// Pixi.js v8 使用异步初始化，需要在 async 函数中 await app.init()
async function bootstrap(): Promise<void> {
  // 1. 创建应用实例
  const app = new Application();

  // 2. 初始化：resizeTo 让画布自动适配窗口大小
  await app.init({
    background: "#1099bb",
    resizeTo: window,
    antialias: true,
  });

  // 3. 将 Pixi 生成的 canvas 挂载到 DOM 中
  const root = document.getElementById("app");
  if (!root) {
    throw new Error("未找到挂载节点 #app");
  }
  root.appendChild(app.canvas);

  // 4. 画一个示例图形：圆角矩形
  const box = new Graphics()
    .roundRect(-60, -60, 120, 120, 16)
    .fill(0xffffff);

  // 将图形放到屏幕中心
  box.position.set(app.screen.width / 2, app.screen.height / 2);
  app.stage.addChild(box);

  // 5. 用 ticker 驱动每帧动画，让图形旋转
  app.ticker.add((ticker) => {
    box.rotation += 0.02 * ticker.deltaTime;
  });
}

bootstrap();
