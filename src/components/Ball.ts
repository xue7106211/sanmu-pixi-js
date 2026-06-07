import { Container, Graphics } from "pixi.js";

/**
 * Ball —— 组件类：打砖块的小球
 *
 * 设计意图：把「小球」封装成自带速度(vx/vy)的显示对象。
 * 视图（圆形发光体）与运动数据（速度向量）收在同一组件里，
 * 场景只需调用 step(dt) 推进位置、读写 vx/vy 做反弹即可。
 *
 * 坐标约定：小球绘制在局部原点 (0,0)，因此 this.x / this.y 就是「球心」坐标，
 * 碰撞计算全部以球心为基准，逻辑最简洁。
 */
export class Ball extends Container {
  // 速度向量（像素/帧增量）。public 让场景能直接读写以实现反弹。
  vx = 0;
  vy = 0;

  // 基础半径（未缩放）。真实显示半径需乘以 scale，见 scaledRadius。
  readonly radius: number;

  constructor(radius = 9) {
    super();
    this.radius = radius;

    // 圆心在 (0,0)：外圈暖黄 + 内核纯白，做出像素发光小球的质感。
    const g = new Graphics()
      .circle(0, 0, radius)
      .fill(0xffe66a)
      .circle(0, 0, radius * 0.52)
      .fill(0xffffff);
    this.addChild(g);
  }

  /** 设置速度向量。 */
  setVelocity(vx: number, vy: number): void {
    this.vx = vx;
    this.vy = vy;
  }

  /**
   * 按帧增量推进球心位置。
   * @param dt ticker 的 deltaTime（相对 60fps 的帧数），让运动与帧率解耦。
   */
  step(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  /** 当前速率（速度向量的模长），反弹时用来保持总速度不变。 */
  get speed(): number {
    return Math.hypot(this.vx, this.vy);
  }

  /**
   * 实际显示半径 = 基础半径 × 当前缩放。
   * 小球随屏幕等比缩放(scale.set)，碰撞检测必须用这个「真实半径」。
   */
  get scaledRadius(): number {
    return this.radius * this.scale.x;
  }
}
