import {
  Application,
  Assets,
  Sprite,
  Texture,
  Rectangle,
  Graphics,
  Text,
  TextStyle,
  Container,
} from "pixi.js";

// 贴纸精灵表 (Sprite Sheet) 路径：256x256，内含 2x2 共 4 个 128x128 的贴纸
const STICKER_URL = "/assets/stickers.png";

/**
 * 创建一个带文字标签的展示卡片。
 * 用于把「显示对象」和它的「中文说明文字」打包成一组，便于横向排版。
 */
function createLabeledCard(displayObject: Container, label: string): Container {
  const card = new Container();
  card.addChild(displayObject);

  // Text：PixiJS 的文本显示对象，内部会把字符光栅化成纹理再渲染
  const caption = new Text({
    text: label,
    style: new TextStyle({
      fill: "#ffffff",
      fontSize: 16,
      fontFamily: "Microsoft YaHei, sans-serif",
      align: "center",
    }),
  });
  // 文字水平居中放在图形下方
  caption.anchor.set(0.5, 0);
  caption.position.set(0, 150);
  card.addChild(caption);

  return card;
}

async function bootstrap(): Promise<void> {
  // 1. 创建并初始化应用（Pixi v8 异步初始化）
  const app = new Application();
  await app.init({
    background: "#1099bb",
    resizeTo: window,
    antialias: true,
  });

  const root = document.getElementById("app");
  if (!root) {
    throw new Error("未找到挂载节点 #app");
  }
  root.appendChild(app.canvas);

  // 2. 预加载纹理。Assets.load 会返回一个 Texture（外观数据），
  //    这个 Texture 可以被多个 Sprite 复用 —— 这就是「外观与顶点数据分离」的基础。
  const fullTexture: Texture = await Assets.load(STICKER_URL);

  // ============================================================
  // 演示一：Graphics —— 矢量图形（不依赖图片，由 GPU 顶点直接绘制）
  // ============================================================
  const graphics = new Graphics()
    .roundRect(-64, -64, 128, 128, 20)
    .fill(0xffffff)
    .stroke({ width: 4, color: 0x333333 });
  const graphicsCard = createLabeledCard(graphics, "Graphics 矢量图形");

  // ============================================================
  // 演示二：Sprite.from(url) —— 用资源路径直接创建精灵
  //   底层等价于：取出该 url 对应的 Texture，再 new Sprite(texture)
  // ============================================================
  const spriteFrom = Sprite.from(STICKER_URL);
  spriteFrom.anchor.set(0.5); // 锚点设为中心，方便居中定位
  spriteFrom.setSize(128, 128); // 顶点数据：控制渲染尺寸（与纹理原始大小解耦）
  const spriteFromCard = createLabeledCard(spriteFrom, "Sprite.from(路径)");

  // ============================================================
  // 演示三：new Sprite(texture) —— 显式传入材质创建精灵
  // ============================================================
  const spriteByTexture = new Sprite(fullTexture);
  spriteByTexture.anchor.set(0.5);
  spriteByTexture.setSize(128, 128);
  const spriteTextureCard = createLabeledCard(
    spriteByTexture,
    "new Sprite(texture)"
  );

  // ============================================================
  // 演示四：局部裁剪（外观与顶点数据分离的进阶用法）
  //   复用同一份 GPU 纹理来源(source)，只通过 frame 框选「左上角那颗红心」。
  //   外观(frame) 与 顶点(position/size) 完全独立，互不影响。
  // ============================================================
  const heartTexture = new Texture({
    source: fullTexture.source, // 复用同一张底图的 GPU 资源，零额外显存开销
    frame: new Rectangle(0, 0, 128, 128), // 只取左上角 128x128 区域
  });
  const heartSprite = new Sprite(heartTexture);
  heartSprite.anchor.set(0.5);
  heartSprite.setSize(128, 128);
  const heartCard = createLabeledCard(heartSprite, "局部裁剪 frame(0,0)");

  // 3. 横向排版：把四张卡片均匀分布在屏幕中部
  const cards = [graphicsCard, spriteFromCard, spriteTextureCard, heartCard];
  const layout = new Container();
  const gap = 200;
  cards.forEach((card, i) => {
    card.position.set(i * gap, 0);
    layout.addChild(card);
  });
  // 整体居中
  layout.position.set(
    app.screen.width / 2 - ((cards.length - 1) * gap) / 2,
    app.screen.height / 2 - 40
  );
  app.stage.addChild(layout);

  // 4. 顶部标题
  const title = new Text({
    text: "PixiJS 核心显示对象：Graphics / Sprite / Text + 局部裁剪",
    style: new TextStyle({
      fill: "#ffffff",
      fontSize: 22,
      fontWeight: "bold",
      fontFamily: "Microsoft YaHei, sans-serif",
    }),
  });
  title.anchor.set(0.5, 0);
  title.position.set(app.screen.width / 2, 40);
  app.stage.addChild(title);

  // 5. 用 ticker 给「局部裁剪的红心」做一个轻微脉动动画，证明它是独立的活动对象
  let t = 0;
  app.ticker.add((ticker) => {
    t += 0.05 * ticker.deltaTime;
    const s = 1 + Math.sin(t) * 0.1;
    heartSprite.scale.set((128 / heartTexture.width) * s); // scale 属于顶点数据，不改变纹理
  });
}

bootstrap();
