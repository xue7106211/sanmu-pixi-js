import { Container, Graphics } from "pixi.js";
import type { Ball } from "./Ball";

/**
 * 单块砖的运行时数据。
 * 把「视图节点(node)」与「碰撞数据(中心点 cx/cy、半宽高 w/h)」「业务数据(分数/存活)」
 * 绑在一个结构里，碰撞检测时直接遍历即可。
 */
type Brick = {
  node: Graphics;
  alive: boolean;
  points: number;
  color: number;
  cx: number; // 砖块中心 x（屏幕坐标）
  cy: number; // 砖块中心 y
  w: number; // 砖块宽
  h: number; // 砖块高
};

/** 砖块区域：BrickField 在这个矩形范围内铺满网格。 */
export type BrickArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * BrickField —— 组件类：打砖块的砖块阵
 *
 * 职责（高内聚）：
 *  1. 创建并管理 rows×cols 个砖块节点（构造时一次性创建，避免运行时频繁增删）。
 *  2. layout(area)：按给定区域计算每块砖的尺寸与位置并重绘（响应式）。
 *  3. hitTest(ball)：圆-矩形碰撞检测 + 反弹 + 消除，命中则返回得分。
 *  4. remaining() / reset()：查询剩余砖块、整场复位（重开游戏用）。
 *
 * Design Rationale：
 *  - 砖块节点「只创建一次」，靠 alive 标志位 + visible 控制显隐与参与碰撞，
 *    比每局 destroy/new 更省 GC，也便于 resize 时按索引保留存活状态。
 */
export class BrickField extends Container {
  private readonly bricks: Brick[] = [];
  private readonly cols: number;
  private readonly rows: number;

  // 每一行的配色与分值（越靠上分越高，经典打砖块规则）。
  private static readonly ROW_COLORS = [
    0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x2a8cff, 0x7d3cff,
  ];
  private static readonly ROW_POINTS = [60, 50, 40, 30, 20, 10];

  constructor(cols = 9, rows = 5) {
    super();
    this.cols = cols;
    this.rows = rows;

    // 一次性创建所有砖块节点；尺寸/位置留到 layout 再算。
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const node = new Graphics();
        this.addChild(node);
        this.bricks.push({
          node,
          alive: true,
          points: BrickField.ROW_POINTS[r % BrickField.ROW_POINTS.length],
          color: BrickField.ROW_COLORS[r % BrickField.ROW_COLORS.length],
          cx: 0,
          cy: 0,
          w: 0,
          h: 0,
        });
      }
    }
  }

  /**
   * 在指定区域内铺满网格并重绘。
   * 计算每块砖的真实屏幕坐标(cx/cy)与尺寸(w/h)，供碰撞检测使用。
   */
  layout(area: BrickArea): void {
    const gap = Math.max(4, area.width * 0.006); // 砖块间隙随宽度自适应
    const cellW = (area.width - gap * (this.cols + 1)) / this.cols;
    const cellH = Math.max(
      14,
      (area.height - gap * (this.rows + 1)) / this.rows
    );

    this.bricks.forEach((brick, index) => {
      const col = index % this.cols;
      const row = Math.floor(index / this.cols);

      // 砖块左上角，再换算成中心点（碰撞用中心 + 半宽高更方便）。
      const left = area.x + gap + col * (cellW + gap);
      const top = area.y + gap + row * (cellH + gap);
      brick.w = cellW;
      brick.h = cellH;
      brick.cx = left + cellW / 2;
      brick.cy = top + cellH / 2;

      this.redraw(brick);
    });
  }

  /**
   * 圆-矩形碰撞检测（AABB 膨胀法）。
   *
   * 核心机制：把砖块的半宽高各「膨胀」一个球半径 r，问题就退化为
   * 「球心是否落在膨胀后的矩形内」。命中后比较 x/y 两轴的穿透深度，
   * 沿穿透更浅的轴反弹（penetration resolution），并把球推出砖体，避免粘连。
   *
   * @returns 命中并消除则返回该砖分值；未命中返回 null。
   */
  hitTest(ball: Ball): number | null {
    const r = ball.scaledRadius;

    for (const brick of this.bricks) {
      if (!brick.alive) {
        continue;
      }

      const halfW = brick.w / 2 + r;
      const halfH = brick.h / 2 + r;
      const dx = ball.x - brick.cx;
      const dy = ball.y - brick.cy;

      // 球心未进入膨胀矩形 → 不可能相交，跳过。
      if (Math.abs(dx) >= halfW || Math.abs(dy) >= halfH) {
        continue;
      }

      // 两轴穿透深度：值越小说明从该方向「插入」得越浅，应沿该轴反弹。
      const overlapX = halfW - Math.abs(dx);
      const overlapY = halfH - Math.abs(dy);

      if (overlapX < overlapY) {
        // 水平方向反弹：vx 取与 dx 同号（把球弹离砖块），并推出穿透量。
        ball.vx = Math.abs(ball.vx) * (dx >= 0 ? 1 : -1);
        ball.x += dx >= 0 ? overlapX : -overlapX;
      } else {
        // 垂直方向反弹。
        ball.vy = Math.abs(ball.vy) * (dy >= 0 ? 1 : -1);
        ball.y += dy >= 0 ? overlapY : -overlapY;
      }

      brick.alive = false;
      brick.node.visible = false;
      return brick.points; // 一帧只处理一块，避免多块同时反弹导致方向抖动
    }

    return null;
  }

  /** 剩余存活砖块数。用于判断「通关」。 */
  remaining(): number {
    return this.bricks.reduce((sum, b) => sum + (b.alive ? 1 : 0), 0);
  }

  /** 整场复位：所有砖块复活并重绘。重开游戏时调用。 */
  reset(): void {
    this.bricks.forEach((brick) => {
      brick.alive = true;
      this.redraw(brick);
    });
  }

  /** 重绘单块砖：死亡则隐藏；存活则画主体 + 顶部高光 + 底部暗边的像素立体感。 */
  private redraw(brick: Brick): void {
    brick.node.clear();
    if (!brick.alive) {
      brick.node.visible = false;
      return;
    }

    brick.node.visible = true;
    const left = brick.cx - brick.w / 2;
    const top = brick.cy - brick.h / 2;

    // 主体
    brick.node.rect(left, top, brick.w, brick.h).fill(brick.color);
    // 顶部高光（半透明白）
    brick.node
      .rect(left, top, brick.w, Math.max(2, brick.h * 0.22))
      .fill({ color: 0xffffff, alpha: 0.28 });
    // 底部暗边（半透明黑）
    brick.node
      .rect(left, top + brick.h - Math.max(2, brick.h * 0.2), brick.w, Math.max(2, brick.h * 0.2))
      .fill({ color: 0x000000, alpha: 0.32 });
  }
}
