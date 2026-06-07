import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
  type DestroyOptions,
} from "pixi.js";
import { LoadingStar } from "../components/LoadingStar";
import { RainbowMaskedText } from "../components/RainbowMaskedText";
import { Scoreboard } from "../components/Scoreboard";
import { Ball } from "../components/Ball";
import { BrickField } from "../components/BrickField";
import type { ResourceLoader } from "../resources/ResourceLoader";

// type 用来声明一个 TypeScript 类型别名，只在编译期做类型检查，不会出现在最终 JS 里。
type PixelParticle = {
  node: Graphics;
  baseX: number;
  baseY: number;
  drift: number;
  phase: number;
};

// 场景状态机：menu(标题菜单态) / playing(游戏进行态) / gameover(结算态)。
// 用字面量联合类型约束状态只能取这三个值，配合 switch/if 做分支渲染。
type PlaySceneState = "menu" | "playing" | "gameover";

// 初始生命数：归零即 Game Over。
const INITIAL_LIVES = 3;

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

  // —— 场景状态 ——
  // state 决定当前是「菜单态 / 游戏态 / 结算态」，layout/update 据此切换显示与排版。
  private state: PlaySceneState = "menu";
  private score = 0;
  // scoreboard 在游戏开始时「动态创建」，菜单态下为 null（按需创建，避免提前占用资源）。
  private scoreboard: Scoreboard | null = null;

  // —— 打砖块玩法对象（均在游戏开始时按需创建）——
  private ball: Ball | null = null;
  private brickField: BrickField | null = null;
  private livesText: Text | null = null;
  private gameOverPanel: Container | null = null;
  private gameOverTitle: Text | null = null;
  private gameOverHint: Text | null = null;

  // —— 运行时状态 ——
  private lives = INITIAL_LIVES;
  private ballLaunched = false; // 小球是否已发射（未发射时吸附在挡板上）
  private worldScale = 1; // 当前世界缩放（由 layout 计算，碰撞/速度都要乘它）
  private fieldTop = 0; // 游戏区顶部边界 y（小球在此反弹，避开顶部 HUD）
  private paddleX = 0; // 挡板目标 x（键盘/鼠标共同写入，update 统一应用）

  // 键盘按键状态：用布尔位记录方向键是否按下，update 里据此移动挡板。
  private moveLeft = false;
  private moveRight = false;
  // 鼠标/触摸的最新 x（屏幕坐标）；null 表示尚无指针输入。
  private pointerX: number | null = null;

  // 持有 Application：需要它的 canvas 做指针坐标换算、以及传给子组件。
  private readonly app: Application;

  // 缓存最近一次的屏幕尺寸：状态切换时需要主动触发一次重排版（而非等 resize）。
  private lastWidth = 0;
  private lastHeight = 0;

  private logoBaseY = 0;
  private sceneTime = 0;

  // constructor 是类的构造函数；new PlayScene(app) 时会自动执行。
  // app: Application 表示调用方必须传入 PixiJS Application 实例。
  constructor(app: Application, resources: ResourceLoader) {
    // 继承类的构造函数里必须先调用 super()，让父类 Container 完成初始化。
    super();
    this.app = app;

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

    // 让 Start 按钮可点击，点击后进入游戏态。
    this.enableStartButton();

    // 注册键盘/指针输入监听（挡板控制、小球发射、Game Over 重开）。
    this.registerInput();
  }

  /**
   * 注册全局输入监听。
   *
   * 为什么用 window 级 DOM 监听而非 Pixi 事件？
   *  - 键盘事件本身就是文档级的，没有「焦点对象」概念，window 监听最直接。
   *  - 指针移动需要在整个画布范围跟随，window + canvas 坐标换算比逐对象命中更省心。
   * 关键：所有 handler 都用「箭头函数字段」声明，保证引用稳定，destroy 时能精确移除，避免内存泄漏。
   */
  private registerInput(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerdown", this.onPointerDown);
  }

  // 箭头函数字段：this 永远指向当前场景实例，且引用稳定（可被 removeEventListener 命中）。
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    switch (event.code) {
      case "ArrowLeft":
      case "KeyA":
        this.moveLeft = true;
        break;
      case "ArrowRight":
      case "KeyD":
        this.moveRight = true;
        break;
      case "Space":
        // 空格：游戏态发射小球；结算态重开。preventDefault 阻止页面滚动。
        event.preventDefault();
        if (this.state === "playing") this.launchBall();
        else if (this.state === "gameover") this.restart();
        break;
      case "KeyR":
        if (this.state === "gameover") this.restart();
        break;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") this.moveLeft = false;
    if (event.code === "ArrowRight" || event.code === "KeyD") this.moveRight = false;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.pointerX = this.toWorldX(event.clientX);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.pointerX = this.toWorldX(event.clientX);
    // 游戏态点击发射小球；结算态点击重开。菜单态交给 Start 按钮自身处理。
    if (this.state === "playing") this.launchBall();
    else if (this.state === "gameover") this.restart();
  };

  /**
   * 把浏览器 clientX 换算成场景内的世界 x。
   * canvas 的 CSS 显示宽度可能与渲染逻辑宽度(app.screen.width)不同，
   * 用 getBoundingClientRect 求出缩放比，保证鼠标与挡板精确对齐。
   */
  private toWorldX(clientX: number): number {
    const rect = this.app.canvas.getBoundingClientRect();
    const ratio = rect.width > 0 ? this.lastWidth / rect.width : 1;
    return (clientX - rect.left) * ratio;
  }

  /**
   * 销毁场景时移除全局监听，防止「场景已销毁、监听仍在」的内存泄漏与空指针。
   * 覆写父类 destroy，先清理自己的副作用，再交给 super 释放显示资源。
   */
  destroy(options?: DestroyOptions): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
    super.destroy(options);
  }

  /**
   *
   * PixiJS v8 事件机制：
   *  - eventMode = "static" 让对象参与命中检测（可被指针事件捕获）。
   *  - cursor = "pointer" 仅影响鼠标悬停时的光标样式。
   *  - "pointertap" 是「按下并在同一对象上抬起」的语义事件，等价于点击，
   *    且同时兼容鼠标与触摸，比单纯监听 click 更通用。
   *
   * 这里把彩虹 Start(startText) 与像素回退文字(startFallbackText) 都设为可点击，
   * 扩大有效命中区域；重复触发由 startGame 内部的状态守卫拦截，不会重复进入游戏。
   */
  private enableStartButton(): void {
    [this.startText, this.startFallbackText].forEach((target) => {
      target.eventMode = "static";
      target.cursor = "pointer";
      target.on("pointertap", () => this.startGame());
    });
  }

  /**
   * 从「菜单态」切换到「游戏态」：场景元素切换 + 状态初始化。
   *
   * 流程：
   *  1. 状态守卫：已经在游戏态则直接返回，避免重复初始化。
   *  2. 初始化游戏状态（分数归零等）。
   *  3. 隐藏菜单态专属元素（BLOCK/BACK 标题 logo、Start 按钮）。
   *  4. 动态创建计分板（仅首次创建，再次进入复用同一实例并 reset）。
   *  5. 主动触发一次 layout，让保留元素（星星 / 挡板）与新计分板按游戏态重新定位。
   */
  private startGame(): void {
    if (this.state === "playing") {
      return;
    }
    this.state = "playing";

    // 隐藏菜单态元素：logoLayer 含标题与像素 Start，startText 是彩虹 Start。
    this.logoLayer.visible = false;
    this.startText.visible = false;

    // 动态创建并显示计分文本（按需创建一次）
    if (!this.scoreboard) {
      this.scoreboard = new Scoreboard();
      this.uiLayer.addChild(this.scoreboard);
    }
    this.scoreboard.visible = true;

    // 创建打砖块玩法对象（小球 / 砖块阵 / 生命数 / 结算面板），仅首次创建。
    this.setupGameObjects();

    // 重排版让所有元素落位，再做一局初始化（分数/生命/砖块/小球复位）。
    this.layout(this.lastWidth, this.lastHeight);
    this.resetGame();
  }

  /** 按需创建打砖块所需的所有显示对象（懒加载，仅第一次进入游戏时执行）。 */
  private setupGameObjects(): void {
    if (this.ball) {
      return; // 已创建过，直接复用
    }

    this.brickField = new BrickField(9, 5);
    this.gameplayLayer.addChild(this.brickField);

    this.ball = new Ball(9);
    this.gameplayLayer.addChild(this.ball);

    // 生命数文字，挂在 UI 层右上角。
    this.livesText = new Text({
      text: "",
      style: new TextStyle({
        fill: "#ff8fae",
        fontFamily: '"Courier New", monospace',
        fontSize: 20,
        fontWeight: "bold",
        letterSpacing: 2,
      }),
    });
    this.livesText.anchor.set(1, 0); // 右上角对齐
    this.uiLayer.addChild(this.livesText);

    // 结算面板：半透明遮罩 + 标题 + 提示，整体显隐由 visible 控制。
    this.gameOverPanel = new Container();
    this.gameOverPanel.visible = false;
    const dim = new Graphics();
    dim.label = "dim"; // 标记一下，layout 时按屏幕尺寸重绘
    this.gameOverPanel.addChild(dim);

    this.gameOverTitle = new Text({
      text: "GAME OVER",
      style: new TextStyle({
        fill: "#ffffff",
        fontFamily: '"Arial Black", Impact, "Courier New", sans-serif',
        fontSize: 64,
        fontWeight: "900",
        letterSpacing: 4,
        stroke: { color: "#3a0d33", width: 8 },
        align: "center",
      }),
    });
    this.gameOverTitle.anchor.set(0.5);

    this.gameOverHint = new Text({
      text: "按 R 或 点击屏幕 重新开始",
      style: new TextStyle({
        fill: "#ffd36a",
        fontFamily: '"Courier New", monospace',
        fontSize: 22,
        fontWeight: "bold",
        letterSpacing: 2,
        align: "center",
      }),
    });
    this.gameOverHint.anchor.set(0.5);

    this.gameOverPanel.addChild(this.gameOverTitle, this.gameOverHint);
    this.uiLayer.addChild(this.gameOverPanel);
  }

  /** 开新的一整局：分数清零、生命满血、砖块全复活、回到「待发射」状态。 */
  private resetGame(): void {
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.scoreboard?.setScore(this.score);
    this.brickField?.reset();
    this.updateLivesText();

    // 挡板回到屏幕中央。
    this.paddleX = this.lastWidth / 2;
    this.paddle.x = this.paddleX;

    this.resetBall();
    this.state = "playing";
    if (this.gameOverPanel) {
      this.gameOverPanel.visible = false;
    }
  }

  /** 把小球吸附回挡板正上方，进入「待发射」状态（每次掉球/开局调用）。 */
  private resetBall(): void {
    this.ballLaunched = false;
    if (!this.ball) {
      return;
    }
    this.ball.scale.set(this.worldScale);
    this.ball.setVelocity(0, 0);
    const paddleTop = this.paddle.y - 5 * this.worldScale;
    this.ball.position.set(this.paddle.x, paddleTop - this.ball.scaledRadius - 1);
  }

  /** 发射小球：给一个略带随机水平分量的向上初速度。 */
  private launchBall(): void {
    if (this.ballLaunched || !this.ball) {
      return;
    }
    this.ballLaunched = true;
    const speed = 7 * this.worldScale;
    // 初始角度在竖直方向附近随机偏 ±20°，避免每次都垂直弹。
    const angle = (Math.random() - 0.5) * (Math.PI / 4.5);
    this.ball.setVelocity(speed * Math.sin(angle), -speed * Math.cos(angle));
  }

  /** 丢失一条命：扣血后若还有命则重置小球，否则触发 Game Over。 */
  private loseLife(): void {
    this.lives -= 1;
    this.updateLivesText();
    if (this.lives <= 0) {
      this.triggerGameOver(false);
    } else {
      this.resetBall();
    }
  }

  /** 进入结算态：win 表示通关胜利，否则为生命耗尽失败。 */
  private triggerGameOver(win: boolean): void {
    this.state = "gameover";
    this.ballLaunched = false;
    this.ball?.setVelocity(0, 0);
    if (this.gameOverTitle) {
      this.gameOverTitle.text = win ? "YOU WIN!" : "GAME OVER";
    }
    if (this.gameOverPanel) {
      this.gameOverPanel.visible = true;
    }
  }

  /** 从结算态重开一整局。 */
  private restart(): void {
    if (this.state !== "gameover") {
      return;
    }
    this.resetGame();
  }

  /** 刷新生命数文字（用 ♥ 直观呈现剩余生命）。 */
  private updateLivesText(): void {
    if (this.livesText) {
      this.livesText.text = `LIVES ${"\u2665".repeat(Math.max(0, this.lives))}`;
    }
  }

  // : void 表示这个方法没有返回值。resize 时 main.ts 会调用它重新排版。
  layout(screenWidth: number, screenHeight: number): void {
    // 缓存尺寸：状态切换(startGame)时无 resize 事件，需要复用这份尺寸主动重排。
    this.lastWidth = screenWidth;
    this.lastHeight = screenHeight;

    // clear() 清空上一帧/上一次布局画过的图形，避免重复叠加绘制命令。
    this.background.clear().rect(0, 0, screenWidth, screenHeight).fill(0x000000);

    // Math.min 取最小值，让场景在不同屏幕下等比缩放，最大不超过 1 倍。
    const scale = Math.min(screenWidth / 960, screenHeight / 960, 1);
    const cx = screenWidth / 2;
    this.worldScale = scale; // 缓存：小球速度/半径、碰撞箱都要乘它

    this.logoBaseY = Math.max(150, screenHeight * 0.22);
    this.logoLayer.scale.set(scale);
    this.logoLayer.position.set(cx, this.logoBaseY);
    this.backText.position.set(0, -46);
    this.blockText.position.set(0, 16);
    this.drawBlockSilhouette();

    this.paddle.scale.set(scale);
    const paddleY = Math.max(this.logoBaseY + 360 * scale, screenHeight * 0.78);
    if (this.state === "menu") {
      // 菜单态：挡板停在固定装饰位置。
      this.paddle.position.set(Math.max(140, screenWidth * 0.25), paddleY);
      this.paddleX = this.paddle.x;
    } else {
      // 游戏态/结算态：x 由输入驱动(this.paddleX)，这里只更新 y 并做边界夹取。
      const halfW = 63 * scale;
      this.paddleX = Math.min(Math.max(this.paddleX, halfW), screenWidth - halfW);
      this.paddle.position.set(this.paddleX, paddleY);
    }

    this.startText.scale.set(scale);
    const startScreenY = this.logoBaseY + 520 * scale;
    this.startText.position.set(cx, startScreenY);
    this.startFallbackText.scale.set(1);
    // startFallbackText 挂在 logoLayer 里，所以这里要把屏幕坐标换成 logoLayer 的局部坐标。
    this.startFallbackText.position.set(0, (startScreenY - this.logoBaseY) / scale);

    // —— 核心元素定位（区分状态）——
    // 计分板顶部居中显示，星星紧挨在计分板左侧，作为游戏态的角色/标识。
    if (this.state !== "menu" && this.scoreboard) {
      const scoreboardY = Math.max(48, screenHeight * 0.07);
      this.scoreboard.scale.set(scale);
      this.scoreboard.position.set(cx, scoreboardY);

      // 星星保留显示并重新定位到计分板左上方，与计分板形成一组 HUD。
      this.heroStar.scale.set(scale * 1.1);
      this.heroStar.position.set(cx - 150 * scale, scoreboardY + 24 * scale);

      // 生命数显示在右上角。
      if (this.livesText) {
        this.livesText.position.set(screenWidth - 24, 18);
      }

      // 游戏区顶部边界：留在 HUD 下方，小球到这里就向下反弹。
      this.fieldTop = scoreboardY + 70 * scale;

      // 砖块阵铺在游戏区上半部分。
      this.brickField?.layout({
        x: screenWidth * 0.06,
        y: this.fieldTop + 6,
        width: screenWidth * 0.88,
        height: screenHeight * 0.32,
      });

      // 结算面板：重绘全屏半透明遮罩并居中标题/提示。
      this.layoutGameOverPanel(screenWidth, screenHeight);

      // 挡板未发射时小球吸附其上，这里把球同步到挡板位置。
      if (!this.ballLaunched) {
        this.resetBall();
      }
    } else {
      // 菜单态：星星跟随标题 logo 漂浮在右下方。
      this.heroStar.scale.set(scale);
      this.heroStar.position.set(cx + 72 * scale, this.logoBaseY + 185 * scale);
    }

    this.layoutParticles(screenWidth, screenHeight);
  }

  /** 重绘结算面板：全屏半透明遮罩 + 居中的标题与提示文字。 */
  private layoutGameOverPanel(screenWidth: number, screenHeight: number): void {
    if (!this.gameOverPanel) {
      return;
    }
    const dim = this.gameOverPanel.getChildByLabel("dim") as Graphics | null;
    dim?.clear().rect(0, 0, screenWidth, screenHeight).fill({ color: 0x05020a, alpha: 0.72 });

    const cx = screenWidth / 2;
    const cy = screenHeight / 2;
    this.gameOverTitle?.position.set(cx, cy - 30);
    this.gameOverHint?.position.set(cx, cy + 40);
  }

  // update 由 PixiJS Ticker 每帧调用；deltaTime 是相对 60fps 的帧增量。
  update(deltaTime: number): void {
    this.sceneTime += deltaTime;

    // 星星与粒子在所有状态下都持续动画（属于保留的核心/装饰元素）。
    this.heroStar.update(deltaTime);
    this.updateParticles();

    if (this.state === "menu") {
      // 菜单态：驱动标题、彩虹 Start 与像素 Start 的循环动画。
      this.blockText.update(deltaTime);
      this.startText.update(deltaTime);

      // Math.sin 生成 -1 到 1 的周期波，用来做轻微漂浮、闪烁等循环动画。
      this.logoLayer.y = this.logoBaseY + Math.sin(this.sceneTime * 0.035) * 3;
      this.startFallbackText.alpha = 0.72 + Math.sin(this.sceneTime * 0.045) * 0.18;

      // 菜单态挡板做轻微往复漂浮（纯装饰）。
      this.paddle.x += Math.sin(this.sceneTime * 0.025) * 0.28;
      return;
    }

    if (this.state === "playing") {
      this.updatePlaying(deltaTime);
    }
    // gameover 态：保留画面静止，仅等待重开输入，无需每帧逻辑。
  }

  /**
   * 游戏态每帧逻辑：挡板控制 → 小球运动 → 边界/挡板/砖块碰撞 → 掉球判定。
   */
  private updatePlaying(deltaTime: number): void {
    this.movePaddle(deltaTime);

    if (!this.ball) {
      return;
    }

    // 未发射：小球吸附在挡板正上方，跟随挡板移动。
    if (!this.ballLaunched) {
      const paddleTop = this.paddle.y - 5 * this.worldScale;
      this.ball.position.set(this.paddle.x, paddleTop - this.ball.scaledRadius - 1);
      return;
    }

    // 已发射：推进位置并依次处理各类碰撞。
    this.ball.step(deltaTime);
    this.handleWallCollision();
    this.handlePaddleCollision();
    this.handleBrickCollision();
    this.handleBallFell();
  }

  /** 挡板移动：键盘(方向键/AD)与鼠标共同写入 paddleX，再夹取到屏幕内并应用。 */
  private movePaddle(deltaTime: number): void {
    const speed = 9 * this.worldScale;

    // 键盘：按住方向键时持续位移。
    if (this.moveLeft) this.paddleX -= speed * deltaTime;
    if (this.moveRight) this.paddleX += speed * deltaTime;

    // 鼠标：指针 x 直接作为挡板目标（优先级与键盘叠加，最后一次输入生效）。
    if (this.pointerX !== null) {
      this.paddleX = this.pointerX;
      this.pointerX = null; // 消费后清空，避免锁死键盘控制
    }

    // 边界夹取：挡板不能出屏。
    const halfW = 63 * this.worldScale;
    this.paddleX = Math.min(Math.max(this.paddleX, halfW), this.lastWidth - halfW);
    this.paddle.x = this.paddleX;
  }

  /** 左右墙与顶部边界反弹。 */
  private handleWallCollision(): void {
    if (!this.ball) return;
    const r = this.ball.scaledRadius;

    if (this.ball.x - r <= 0) {
      this.ball.x = r;
      this.ball.vx = Math.abs(this.ball.vx);
    } else if (this.ball.x + r >= this.lastWidth) {
      this.ball.x = this.lastWidth - r;
      this.ball.vx = -Math.abs(this.ball.vx);
    }

    if (this.ball.y - r <= this.fieldTop) {
      this.ball.y = this.fieldTop + r;
      this.ball.vy = Math.abs(this.ball.vy);
    }
  }

  /**
   * 挡板碰撞：小球向下且进入挡板碰撞箱时反弹向上，
   * 并按「击中点相对挡板中心的偏移」改变水平方向 —— 越靠边角度越斜，
   * 这是经典打砖块「用挡板控制球路」的手感来源。
   */
  private handlePaddleCollision(): void {
    if (!this.ball || this.ball.vy <= 0) return;

    const r = this.ball.scaledRadius;
    const halfW = 63 * this.worldScale + r;
    const halfH = 5 * this.worldScale + r;
    const dx = this.ball.x - this.paddle.x;
    const dy = this.ball.y - this.paddle.y;

    if (Math.abs(dx) < halfW && Math.abs(dy) < halfH) {
      // 把球推到挡板上方，避免下一帧又判定相交。
      this.ball.y = this.paddle.y - halfH;
      // t∈[-1,1]：击中点归一化偏移；映射到最大 ±60° 的反弹角。
      const t = Math.max(-1, Math.min(1, dx / halfW));
      const angle = t * (Math.PI / 3);
      const speed = this.ball.speed || 7 * this.worldScale;
      this.ball.vx = speed * Math.sin(angle);
      this.ball.vy = -Math.abs(speed * Math.cos(angle));
    }
  }

  /** 砖块碰撞：命中则加分；全部清空则通关。 */
  private handleBrickCollision(): void {
    if (!this.ball || !this.brickField) return;

    const points = this.brickField.hitTest(this.ball);
    if (points !== null) {
      this.score += points;
      this.scoreboard?.addScore(points); // 击中砖块累加计分
      if (this.brickField.remaining() === 0) {
        this.triggerGameOver(true); // 砖块清空 = 通关胜利
      }
    }
  }

  /** 掉球判定：小球完全落到屏幕底部以下，扣一条命。 */
  private handleBallFell(): void {
    if (!this.ball) return;
    if (this.ball.y - this.ball.scaledRadius > this.lastHeight) {
      this.loseLife();
    }
  }

  /** 粒子漂浮动画：从 update 中抽离，便于两种状态复用。 */
  private updateParticles(): void {
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
