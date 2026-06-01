import { Container, Graphics, FillGradient } from "pixi.js";

/**
 * LoadingStar —— 组件类：中央的彩虹五角星
 *
 * 用 Graphics（矢量图形）绘制一个五角星，并用 FillGradient（渐变填充）
 * 还原设计稿中的「彩虹」效果。Graphics 由 GPU 顶点直接绘制，
 * 不依赖任何图片资源，缩放也不会失真。
 */
export class LoadingStar extends Container {
  constructor(radius = 36) {
    super();

    // 1. 计算五角星的 10 个顶点（5 个外角 + 5 个内角交替）
    const points = LoadingStar.buildStarPoints(0, 0, radius, radius * 0.42);

    // 2. FillGradient：线性渐变。从左到右铺一条彩虹色带，
    //    模拟设计稿里星星的多彩像素效果。
    const gradient = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
      colorStops: [
        { offset: 0, color: "#ff3b30" }, // 红
        { offset: 0.25, color: "#ff9500" }, // 橙
        { offset: 0.5, color: "#ffcc00" }, // 黄
        { offset: 0.7, color: "#34c759" }, // 绿
        { offset: 0.85, color: "#007aff" }, // 蓝
        { offset: 1, color: "#af52de" }, // 紫
      ],
    });

    // 3. Graphics 链式 API：poly() 描点成多边形 → fill() 用渐变填充
    const star = new Graphics().poly(points).fill(gradient);
    this.addChild(star);
  }

  /**
   * 生成五角星的顶点数组。
   * @param cx 中心 x
   * @param cy 中心 y
   * @param outer 外半径（角尖）
   * @param inner 内半径（凹陷）
   */
  private static buildStarPoints(
    cx: number,
    cy: number,
    outer: number,
    inner: number
  ): number[] {
    const pts: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      // 从正上方开始（-90°），每个顶点间隔 36°
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
    }
    return pts;
  }
}
