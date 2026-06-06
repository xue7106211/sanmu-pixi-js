import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { LoadingStar } from "../components/LoadingStar";
import { RainbowMaskedText } from "../components/RainbowMaskedText";
import type { ResourceLoader } from "../resources/ResourceLoader";

// type 用来声明一个 TypeScript 类型别名，只在编译期做类型检查，不会出现在最终 JS 里。
type PixelParticle = {
  node: Graphics;
  baseX: number;
  baseY: number;
  drift: number;
  phase: number;
};

// extends 表示 PlayScene 继承 PixiJS 的 Container，因此它本身也是一个可 addChild 的显示容器。
export class PlayScene extends Container {
  // private 表示只允许在当前类内部访问；readonly 表示构造后不再替换这个字段引用。
  // 这里用多个 Container 做场景分层，addChild 的先后顺序就是默认渲染层级。
  private readonly backgroundLayer = new Container();
  private readonly decorationLayer = new Container();
  private readonly logoLayer = new Container();
  private readonly gameplayLayer = new Container();
  private readonly uiLayer = new Container();

  // Graphics 适合画纯色矩形、像素点、轮廓这类矢量图形。
  private readonly background = new Graphics();
  private readonly blockSilhouette = new Graphics();
  // 带冒号的是类型标注，例如 backText: Text 表示该字段必须是 Pixi 的 Text 对象。
  private readonly backText: Text;
  private readonly blockText: RainbowMaskedText;
  private readonly heroStar: LoadingStar;
  private readonly paddle = new Graphics();
  private readonly startText: RainbowMaskedText;
  private readonly startFallbackText: Text;
  // PixelParticle[] 表示数组里的每一项都必须符合 PixelParticle 类型结构。
  private readonly particles: PixelParticle[] = [];

  private logoBaseY = 0;
  private sceneTime = 0;

  // constructor 是类的构造函数；new PlayScene(app) 时会自动执行。
  // app: Application 表示调用方必须传入 PixiJS Application 实例。
  constructor(app: Application, resources: ResourceLoader) {
    // 继承类的构造函数里必须先调用 super()，让父类 Container 完成初始化。
    super();

    // addChild 可以一次加入多个显示对象；越后加入的对象默认越靠上。
    this.addChild(
      this.backgroundLayer,
      this.decorationLayer,
      this.logoLayer,
      this.gameplayLayer,
      this.uiLayer
    );

    this.backgroundLayer.addChild(this.background);
    this.createParticles();

    // new Text({ text, style }) 创建文字对象；TextStyle 用来集中描述字体、颜色、描边等样式。
    this.backText = new Text({
      text: "BACK",
      style: new TextStyle({
        fill: "#ffbd7a",
        fontFamily: '"Arial Black", Impact, "Courier New", sans-serif',
        fontSize: 56,
        fontWeight: "900",
        letterSpacing: 3,
        stroke: { color: "#4b170d", width: 6 },
      }),
    });
    // anchor.set(0.5) 把文字锚点放在中心，后续 position.set(x, y) 就是按中心定位。
    this.backText.anchor.set(0.5);

    // RainbowMaskedText 是自定义组件：内部用文字图片作为 mask，让彩虹平铺材质只显示在文字形状里。
    this.blockText = new RainbowMaskedText(app, {
      text: "BLOCK",
      fontSize: 106,
      letterSpacing: 2,
      speed: 1.5,
      materialTexture: resources.get("rainbowTextMaterial"),
      shadows: [
        { color: 0x141014, x: 10, y: 10 },
        { color: 0x5a130c, x: 0, y: 16 },
      ],
    });

    this.logoLayer.addChild(
      this.blockSilhouette,
      this.backText,
      this.blockText
    );

    this.heroStar = new LoadingStar(26);
    this.decorationLayer.addChild(this.heroStar);

    // Graphics 的链式写法：rect(...) 记录一个矩形路径，fill(...) 给刚才的路径填色。
    this.paddle.rect(0, 0, 126, 10).fill(0x4c18ff);
    this.paddle.rect(0, 7, 126, 3).fill(0x180064);
    this.paddle.pivot.set(63, 5);
    this.gameplayLayer.addChild(this.paddle);

    // Start 也使用彩虹遮罩文字；下方额外 Text 作为更清晰的像素风可读层。
    this.startText = new RainbowMaskedText(app, {
      text: "Start",
      fontSize: 48,
      letterSpacing: 2,
      speed: 1.2,
      materialTexture: resources.get("rainbowTextMaterial"),
      shadows: [
        { color: 0x18003f, x: 4, y: 5 },
        { color: 0xff2d95, x: -3, y: 3 },
      ],
    });
    this.startFallbackText = new Text({
      text: "Start",
      style: new TextStyle({
        fill: "#7158ff",
        fontFamily: '"Courier New", monospace',
        fontSize: 44,
        fontWeight: "900",
        letterSpacing: 2,
        stroke: { color: "#ff2dbd", width: 3 },
      }),
    });
    this.startFallbackText.anchor.set(0.5);
    this.uiLayer.addChild(this.startText);
    this.logoLayer.addChild(this.startFallbackText);
  }

  // : void 表示这个方法没有返回值。resize 时 main.ts 会调用它重新排版。
  layout(screenWidth: number, screenHeight: number): void {
    // clear() 清空上一帧/上一次布局画过的图形，避免重复叠加绘制命令。
    this.background.clear().rect(0, 0, screenWidth, screenHeight).fill(0x000000);

    // Math.min 取最小值，让场景在不同屏幕下等比缩放，最大不超过 1 倍。
    const scale = Math.min(screenWidth / 960, screenHeight / 960, 1);
    const cx = screenWidth / 2;

    this.logoBaseY = Math.max(150, screenHeight * 0.22);
    this.logoLayer.scale.set(scale);
    this.logoLayer.position.set(cx, this.logoBaseY);
    this.backText.position.set(0, -46);
    this.blockText.position.set(0, 16);
    this.drawBlockSilhouette();

    this.heroStar.scale.set(scale);
    this.heroStar.position.set(cx + 72 * scale, this.logoBaseY + 185 * scale);

    this.paddle.scale.set(scale);
    this.paddle.position.set(
      Math.max(140, screenWidth * 0.25),
      Math.max(this.logoBaseY + 360 * scale, screenHeight * 0.78)
    );

    this.startText.scale.set(scale);
    const startScreenY = this.logoBaseY + 520 * scale;
    this.startText.position.set(cx, startScreenY);
    this.startFallbackText.scale.set(1);
    // startFallbackText 挂在 logoLayer 里，所以这里要把屏幕坐标换成 logoLayer 的局部坐标。
    this.startFallbackText.position.set(0, (startScreenY - this.logoBaseY) / scale);

    this.layoutParticles(screenWidth, screenHeight);
  }

  // update 由 PixiJS Ticker 每帧调用；deltaTime 是相对 60fps 的帧增量。
  update(deltaTime: number): void {
    this.sceneTime += deltaTime;

    // 把每帧时间继续传给子组件，让各组件自己处理内部动画。
    this.blockText.update(deltaTime);
    this.startText.update(deltaTime);
    this.heroStar.update(deltaTime);

    // Math.sin 生成 -1 到 1 的周期波，用来做轻微漂浮、闪烁等循环动画。
    this.logoLayer.y = this.logoBaseY + Math.sin(this.sceneTime * 0.035) * 3;
    this.paddle.x += Math.sin(this.sceneTime * 0.025) * 0.28;
    this.startFallbackText.alpha = 0.72 + Math.sin(this.sceneTime * 0.045) * 0.18;

    // forEach 遍历数组；particle 是当前项。箭头函数会保留外层 this 指向。
    this.particles.forEach((particle) => {
      const wave = Math.sin(this.sceneTime * particle.drift + particle.phase);
      particle.node.x = particle.baseX + wave * 4;
      particle.node.y = particle.baseY + Math.cos(this.sceneTime * 0.015 + particle.phase) * 3;
      particle.node.alpha = 0.65 + wave * 0.25;
    });
  }

  private createParticles(): void {
    // const specs = [...] 是粒子配置表；后面根据这些数据批量创建 Graphics 节点。
    const specs = [
      { x: 0.14, y: 0.12, size: 8, color: 0xffee55 },
      { x: 0.4, y: 0.06, size: 9, color: 0x2f6bff },
      { x: 0.8, y: 0.15, size: 10, color: 0x43ffcf },
      { x: 0.12, y: 0.23, size: 9, color: 0xff1bc8 },
      { x: 0.84, y: 0.31, size: 7, color: 0x5fffea },
      { x: 0.33, y: 0.39, size: 10, color: 0xff3b30 },
      { x: 0.67, y: 0.41, size: 10, color: 0x6b21ff },
      { x: 0.9, y: 0.07, size: 4, color: 0xf8f2a4, slash: true },
    ];

    // 第二个参数 index 是当前数组下标，这里用它生成不同的旋转和动画相位。
    specs.forEach((spec, index) => {
      const node = new Graphics();
      if (spec.slash) {
        node.rect(-spec.size / 2, -spec.size * 2, spec.size, spec.size * 5).fill(spec.color);
        node.rotation = -0.72;
      } else {
        node.rect(-spec.size / 2, -spec.size / 2, spec.size, spec.size).fill(spec.color);
        node.rotation = index % 2 === 0 ? 0 : Math.PI / 4;
      }

      this.decorationLayer.addChild(node);
      // push 把新粒子的运行时数据加入 particles 数组，后续 update/layout 会继续使用。
      this.particles.push({
        node,
        baseX: 0,
        baseY: 0,
        drift: 0.018 + index * 0.003,
        phase: index * 1.7,
      });
    });
  }

  private layoutParticles(screenWidth: number, screenHeight: number): void {
    // 二维数组保存粒子相对屏幕的位置比例，例如 0.19 表示屏幕宽度的 19%。
    const positions = [
      [0.19, 0.11],
      [0.4, 0.06],
      [0.8, 0.15],
      [0.12, 0.23],
      [0.84, 0.31],
      [0.33, 0.39],
      [0.67, 0.41],
      [0.9, 0.07],
    ];

    this.particles.forEach((particle, index) => {
      // 数组解构语法：把 [xRatio, yRatio] 从 positions[index] 里拆出来。
      const [xRatio, yRatio] = positions[index];
      particle.baseX = screenWidth * xRatio;
      particle.baseY = screenHeight * yRatio;
      particle.node.position.set(particle.baseX, particle.baseY);
    });
  }

  private drawBlockSilhouette(): void {
    this.blockSilhouette.clear();
    // 这里用多段矩形拼出 BLOCK 后面的深色城堡/积木剪影。
    this.blockSilhouette.rect(-126, -30, 58, 76).fill(0x151315);
    this.blockSilhouette.rect(-48, -30, 72, 76).fill(0x151315);
    this.blockSilhouette.rect(48, -30, 68, 76).fill(0x151315);

    // for 循环语法：初始 x=-142；只要 x<=118 就继续；每次循环后 x 增加 28。
    for (let x = -142; x <= 118; x += 28) {
      this.blockSilhouette.rect(x, -48, 12, 24).fill(0x151315);
    }

    this.blockSilhouette.rect(-154, 36, 298, 18).fill(0x151315);
  }
}
