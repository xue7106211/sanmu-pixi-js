import { Container, Graphics } from "pixi.js";

/**
 * ProgressBar —— 组件类：像素风进度条
 *
 * 设计稿里是一排由小方块组成的进度条：左侧已加载的格子是彩色，
 * 右侧未加载的格子是暗灰色。
 *
 * 实现要点：用一组 Graphics 小方块拼成进度条，并对外暴露
 * setProgress(0~1) 方法来按比例点亮格子 —— 把「数据(进度值)」
 * 和「视图(格子颜色)」解耦，外部 ticker 只需喂数值即可。
 */
export class ProgressBar extends Container {
  private cells: Graphics[] = [];
  private readonly total: number;
  private readonly cellSize: number;

  // 已加载格子的循环配色（彩虹），未加载格子统一暗灰
  private static readonly ACTIVE_COLORS = [
    0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x007aff, 0xaf52de,
  ];
  private static readonly INACTIVE_COLOR = 0x3a3a3a;

  constructor(total = 28, cellSize = 6, gap = 3) {
    super();
    this.total = total;
    this.cellSize = cellSize;

    for (let i = 0; i < total; i++) {
      // 每个格子是一个独立的 Graphics 小方块
      const cell = new Graphics()
        .rect(0, 0, cellSize, cellSize)
        .fill(ProgressBar.INACTIVE_COLOR);
      cell.x = i * (cellSize + gap);
      this.cells.push(cell);
      this.addChild(cell);
    }

    // 让进度条整体以自身中心为锚点（方便外部居中定位）
    this.pivot.set(this.width / 2, this.height / 2);
  }

  /**
   * 按比例点亮格子。
   * @param ratio 0~1 的进度值
   */
  setProgress(ratio: number): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    const litCount = Math.round(clamped * this.total);

    this.cells.forEach((cell, i) => {
      const lit = i < litCount;
      const color = lit
        ? ProgressBar.ACTIVE_COLORS[i % ProgressBar.ACTIVE_COLORS.length]
        : ProgressBar.INACTIVE_COLOR;
      // clear() 清掉旧绘制指令，再重画 —— 避免在同一 Graphics 上叠加图元
      cell.clear().rect(0, 0, this.cellSize, this.cellSize).fill(color);
    });
  }
}
