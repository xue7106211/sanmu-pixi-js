import { Application, Container } from "pixi.js";
import { LoadingScene } from "./scenes/LoadingScene";
import { PlayScene } from "./scenes/PlayScene";
import { ResourceLoader } from "./resources/ResourceLoader";
import { resourceManifest } from "./resources/resourceManifest";

// type 字面量联合类型：SceneRoute 只能取 "loading" 或 "play"。
type SceneRoute = "loading" | "play";

// RoutedScene 表示“可以被路由系统管理的 Pixi 场景”。
// 它既是 Container，也必须提供 layout 和 update。
type RoutedScene = Container & {
  layout(screenWidth: number, screenHeight: number): void;
  update(deltaTime: number): void;
};

async function bootstrap(): Promise<void> {
  const app = new Application();
  await app.init({
    background: "#000000",
    resizeTo: window,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  const root = document.getElementById("app");
  if (!root) {
    throw new Error("未找到挂载节点 #app");
  }
  root.appendChild(app.canvas);

  // ResourceLoader 统一管理 loading / game 两个阶段的资源。
  const resources = new ResourceLoader(resourceManifest);

  // 第一阶段：先加载 loading 界面资源。
  // 这一步完成后，才创建 LoadingScene，避免加载页自己依赖的资源缺失。
  await resources.loadPhase("loading");

  let currentRoute: SceneRoute | null = null;
  let currentScene: RoutedScene | null = null;

  // mountScene 是当前项目的轻量路由函数。
  // 它负责卸载旧场景、创建新场景、加入 stage，并立即执行布局。
  const mountScene = (route: SceneRoute): RoutedScene => {
    if (currentRoute === route && currentScene) return currentScene;

    if (currentScene) {
      app.stage.removeChild(currentScene);
      currentScene.destroy({ children: true });
    }

    currentRoute = route;
    currentScene =
      route === "loading"
        ? new LoadingScene({
            onComplete: () => mountScene("play"),
          })
        : new PlayScene(app, resources);

    app.stage.addChild(currentScene);
    currentScene.layout(app.screen.width, app.screen.height);

    return currentScene;
  };

  const loadingScene = mountScene("loading") as LoadingScene;

  // 第二阶段：LoadingScene 已经上屏后，再加载游戏资源。
  // 真实加载进度通过 setProgress 同步到进度条。
  void loadGameResources(resources, loadingScene);

  window.addEventListener("resize", () => {
    currentScene?.layout(app.screen.width, app.screen.height);
  });

  app.ticker.add((ticker) => {
    currentScene?.update(ticker.deltaTime);
  });
}

async function loadGameResources(
  resources: ResourceLoader,
  loadingScene: LoadingScene
): Promise<void> {
  try {
    // 当前资源很轻，会加载得太快。这个最短展示时间保证 loading 页面至少被用户看到。
    const minVisibleTime = delay(800);

    const gameResources = resources.loadPhase("game", ({ progress }) => {
      loadingScene.setProgress(progress);
    });

    await Promise.all([gameResources, minVisibleTime]);
    loadingScene.setProgress(1);
    loadingScene.complete();
  } catch (error) {
    console.error("游戏资源加载失败", error);
    throw error;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

bootstrap();
