import { Container, Text, TextStyle } from "pixi.js";

/**
 * LoadingLabel —— 组件类：进度条下方的 "Loading." 白色文字
 *
 * 额外提供一个小动画：让末尾的点在 "." / ".." / "..." 间循环，
 * 体现「加载中」的动态感。对外暴露 update(deltaTime) 给场景的 ticker 调用。
 */
export class LoadingLabel extends Container {
  private text: Text;
  private elapsed = 0;
  private readonly baseText = "Loading";

  constructor() {
    super();

    this.text = new Text({
      text: `${this.baseText}.`,
      style: new TextStyle({
        fill: "#ffffff",
        fontSize: 18,
        fontWeight: "bold",
        fontFamily: '"Courier New", monospace',
        align: "center",
      }),
    });
    this.text.anchor.set(0.5);
    this.addChild(this.text);
  }

  /**
   * 每帧调用：每 ~0.4s 切换一次省略号数量（1→2→3→循环）。
   * @param deltaTime ticker 传入的帧时间增量
   */
  update(deltaTime: number): void {
    this.elapsed += deltaTime;
    // ticker 的 deltaTime 约等于「相对 60fps 的帧数」，24 帧 ≈ 0.4s
    const dotCount = (Math.floor(this.elapsed / 24) % 3) + 1;
    const next = this.baseText + ".".repeat(dotCount);
    // 仅在内容变化时才赋值，避免每帧重新光栅化文字纹理
    if (this.text.text !== next) {
      this.text.text = next;
    }
  }
}
