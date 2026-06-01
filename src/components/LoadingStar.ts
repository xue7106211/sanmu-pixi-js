import { Container, Graphics, FillGradient } from "pixi.js";

/** 眨眼行为：中间(直眨) / 向左(眨眼带左看) / 向右(眨眼带右看) */
type BlinkBehavior = "center" | "left" | "right";

/**
 * LoadingStar —— 组件类：会眨眼的彩虹五角星
 *
 * 用 Graphics（矢量图形）绘制一个五角星，并用 FillGradient（渐变填充）
 * 还原设计稿中的「彩虹」效果。Graphics 由 GPU 顶点直接绘制，
 * 不依赖任何图片资源，缩放也不会失真。
 *
 * 眨眼动画设计（状态机 + 时间归一化）：
 *  - 两只眼睛由独立 Container 承载，便于单独做 scale.y(挤压闭合) 与 x(左右看) 变换。
 *  - 三种行为(center/left/right)在每次眨眼时随机选取，配合「定时循环」触发，
 *    形成自然的随机眨眼节奏。
 *  - 关键约束：所有动画的「首帧 t=0」与「尾帧 t=1」都回到完全睁眼且居中的状态，
 *    保证动画衔接时不会出现跳变（用 sin(π·t) 曲线天然满足 0→峰值→0）。
 */
export class LoadingStar extends Container {
  // 两只眼睛（用 Container 包裹，方便整体做缩放/位移变换）
  private leftEye: Container;
  private rightEye: Container;

  // 眼睛布局基准（相对星星中心）
  private readonly eyeBaseX: number; // 单眼水平偏移（左眼取负、右眼取正）
  private readonly eyeBaseY: number; // 眼睛垂直位置
  private readonly lookOffset: number; // 左右看时的最大水平位移量

  // —— 眨眼状态机 ——
  private idleTimer = 0; // 睁眼等待计时（秒）
  private nextBlinkDelay = 0; // 触发下次眨眼所需的等待阈值（秒）
  private animTime = 0; // 当前眨眼动画已播放时长（秒）
  private readonly animDuration = 0.34; // 单次眨眼总时长（秒）
  private isBlinking = false; // 是否正在播放眨眼动画
  private behavior: BlinkBehavior = "center"; // 本次眨眼采用的行为

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

    // 4. 眼睛：尺寸与位置都以 radius 为基准，保证不同大小星星比例一致
    this.eyeBaseX = radius * 0.26;
    this.eyeBaseY = -radius * 0.06;
    this.lookOffset = radius * 0.16;
    const eyeW = radius * 0.13; // 眼睛横向半径
    const eyeH = radius * 0.22; // 眼睛纵向半径

    this.leftEye = LoadingStar.buildEye(eyeW, eyeH);
    this.rightEye = LoadingStar.buildEye(eyeW, eyeH);
    this.leftEye.position.set(-this.eyeBaseX, this.eyeBaseY);
    this.rightEye.position.set(this.eyeBaseX, this.eyeBaseY);
    this.addChild(this.leftEye, this.rightEye);

    // 5. 初始化：安排第一次眨眼的随机等待时间
    this.scheduleNext();
  }

  /**
   * 每帧更新：由场景的 update 透传 ticker.deltaTime。
   * deltaTime 是「帧增量」（60fps 下约为 1），除以 60 换算成秒，
   * 让动画节奏与帧率解耦（掉帧也不会变慢/变快）。
   */
  update(deltaTime: number): void {
    const dt = deltaTime / 60;

    if (this.isBlinking) {
      // 正在眨眼：推进动画时间并按归一化进度 t∈[0,1] 应用变换
      this.animTime += dt;
      const t = Math.min(this.animTime / this.animDuration, 1);
      this.applyBlink(t);

      if (t >= 1) {
        // 动画结束：复位状态机，安排下一次随机眨眼
        this.isBlinking = false;
        this.animTime = 0;
        this.idleTimer = 0;
        this.scheduleNext();
      }
    } else {
      // 睁眼待机：累计时间，超过阈值则随机挑一种行为开始眨眼
      this.idleTimer += dt;
      if (this.idleTimer >= this.nextBlinkDelay) {
        this.isBlinking = true;
        this.behavior = LoadingStar.pickBehavior();
      }
    }
  }

  /**
   * 把归一化进度 t∈[0,1] 映射成眼睛的「睁开度」与「水平位移」。
   *
   * 用 sin(π·t) 作为驱动曲线：t=0→0、t=0.5→1、t=1→0。
   *  - 睁开度 openness = 1 - sin(π·t)：首尾完全睁开(1)，中点完全闭合(≈0)。
   *  - 水平位移 offset = dir · max · sin(π·t)：首尾归零(居中)，中点偏移最大。
   * 因此任何行为都满足「首尾帧相同睁眼状态」，循环衔接无跳变。
   */
  private applyBlink(t: number): void {
    const wave = Math.sin(Math.PI * t);

    // 睁开度：保留极小下限(0.06)，让闭眼呈现一条细线而非彻底消失
    const openness = Math.max(1 - wave, 0.06);

    // 方向系数：左 -1 / 右 +1 / 中 0
    const dir = this.behavior === "left" ? -1 : this.behavior === "right" ? 1 : 0;
    const offset = dir * this.lookOffset * wave;

    this.leftEye.scale.y = openness;
    this.rightEye.scale.y = openness;
    this.leftEye.x = -this.eyeBaseX + offset;
    this.rightEye.x = this.eyeBaseX + offset;
  }

  /** 随机安排下次眨眼的等待时长（秒），制造自然的随机节奏。 */
  private scheduleNext(): void {
    this.nextBlinkDelay = 1.2 + Math.random() * 2.3; // 1.2s ~ 3.5s
  }

  /** 三种眨眼行为等概率随机选取。 */
  private static pickBehavior(): BlinkBehavior {
    const r = Math.random();
    if (r < 1 / 3) return "center";
    if (r < 2 / 3) return "left";
    return "right";
  }

  /**
   * 构建单只眼睛：用 Container 包一个居中(0,0)的椭圆。
   * 居中绘制是关键——这样 scale.y 缩放时会以眼睛中心为轴对称挤压，
   * 闭眼效果才自然（否则会从顶部/底部单边塌陷）。
   */
  private static buildEye(w: number, h: number): Container {
    const eye = new Container();
    const g = new Graphics().ellipse(0, 0, w, h).fill("#1a1a1a");
    eye.addChild(g);
    return eye;
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
