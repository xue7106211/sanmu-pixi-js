import { Container } from "pixi.js";
import { LoadingStar } from "../components/LoadingStar";
import { ProgressBar } from "../components/ProgressBar";
import { LoadingLabel } from "../components/LoadingLabel";
import { LoadingTitle } from "../components/LoadingTitle";

/*
 * LoadingScene —— 场景类（中间层）
 *
 * 职责：用一个 Container 把本场景所有「组件」组织起来，
 * 并负责它们的相对布局与屏幕适配。它不关心每个组件内部怎么画，
 * 只负责「摆放在哪、何时更新」。
 *
 * 分层架构：main(入口) → LoadingScene(场景) → 各 Component(组件)
 *  - 入口只跟场景打交道
 *  - 场景只跟组件打交道
 *  - 组件只管自己内部的显示
 */
export class LoadingScene extends Container {
  private star: LoadingStar;
  private bar: ProgressBar;
  private loadingLabel: LoadingLabel;
  private title: LoadingTitle;

  // 模拟加载进度（0~1）
  private progress = 0;

  constructor() {
    super();

    // 实例化各组件，并按 z-order（添加顺序即层级）挂载到场景容器
    this.star = new LoadingStar(36);
    this.bar = new ProgressBar();
    this.loadingLabel = new LoadingLabel();
    this.title = new LoadingTitle();

    this.addChild(this.star, this.bar, this.loadingLabel, this.title);
  }

  /**
   * 根据画布尺寸做居中布局。
   * 抽成独立方法，便于窗口 resize 时重新调用。
   */
  layout(screenWidth: number, screenHeight: number): void {
    const cx = screenWidth / 2;
    const cy = screenHeight / 2;

    // 以屏幕中心为基准，垂直方向依次排布：星星 → 进度条 → Loading 文字
    this.star.position.set(cx, cy - 30);
    this.bar.position.set(cx, cy + 30);
    this.loadingLabel.position.set(cx, cy + 60);

    // 署名标题放在偏下方
    this.title.position.set(cx, cy + 160);
  }

  /**
   * 每帧更新：推进模拟进度 + 驱动子组件动画。
   * 由入口的 app.ticker 调用，把「时间」从顶层一路传递下来。
   */
  update(deltaTime: number): void {
    // 进度推进到 100% 后归零，循环演示
    this.progress += 0.004 * deltaTime;
    if (this.progress > 1) this.progress = 0;

    this.bar.setProgress(this.progress);
    this.loadingLabel.update(deltaTime);
  }
}
