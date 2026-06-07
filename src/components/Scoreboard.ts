import { Container, Text, TextStyle } from "pixi.js";

/**
 * Scoreboard —— 组件类：游戏态的计分板
 *
 * 设计意图：把「分数显示」封装成一个独立的显示组件，对外只暴露
 * setScore / addScore / reset 这类「数据接口」，把「数值(score)」和
 * 「视图(文字渲染)」解耦 —— 调用方只管喂分数，组件自己负责刷新文字。
 *
 * 结构：一个 Container 里挂两段 Text：
 *  - label：固定的 "SCORE" 标题（一次渲染，后续不变）
 *  - value：动态的分数数字（变化时才重新赋值，避免无谓的纹理重建）
 *
 * 为什么单独成组件而不是直接往 PlayScene 塞 Text？
 *  - 复用与内聚：未来要加「最高分 / 连击 / 倍率」只需在组件内扩展，
 *    PlayScene 仍只持有一个 scoreboard 引用。
 *  - 状态自治：分数自增、格式化（补零、千分位）等逻辑都收敛在组件内部。
 */
export class Scoreboard extends Container {
  private readonly titleLabel: Text;
  private readonly value: Text;
  private score = 0;

  constructor() {
    super();

    // 标题文字：锚点放在底部中心 (0.5, 1)，让它「往上对齐」到组件原点上方。
    this.titleLabel = new Text({
      text: "SCORE",
      style: new TextStyle({
        fill: "#9fa8ff",
        fontFamily: '"Courier New", monospace',
        fontSize: 18,
        fontWeight: "bold",
        letterSpacing: 4,
        align: "center",
      }),
    });
    this.titleLabel.anchor.set(0.5, 1);

    // 分数文字：锚点放在顶部中心 (0.5, 0)，让它「往下排」到标题下方。
    this.value = new Text({
      text: this.format(this.score),
      style: new TextStyle({
        fill: "#ffffff",
        fontFamily: '"Arial Black", Impact, "Courier New", sans-serif',
        fontSize: 40,
        fontWeight: "900",
        letterSpacing: 2,
        stroke: { color: "#1c1740", width: 5 },
        align: "center",
      }),
    });
    this.value.anchor.set(0.5, 0);
    this.value.position.set(0, 6); // 与标题留出一点垂直间距

    this.addChild(this.titleLabel, this.value);
  }

  /** 直接设置分数（会做下限保护并刷新文字）。 */
  setScore(score: number): void {
    const next = Math.max(0, Math.floor(score));
    if (next === this.score) {
      return; // 数值未变就不触碰 Text，避免重复光栅化
    }
    this.score = next;
    this.value.text = this.format(next);
  }

  /** 在当前分数上增量累加，常用于「得分 +N」。 */
  addScore(delta: number): void {
    this.setScore(this.score + delta);
  }

  /** 归零：游戏开始 / 重开时调用。 */
  reset(): void {
    this.setScore(0);
  }

  getScore(): number {
    return this.score;
  }

  /** 分数格式化：固定补零到 6 位，呈现街机风格的 000000。 */
  private format(score: number): string {
    return String(score).padStart(6, "0");
  }
}
