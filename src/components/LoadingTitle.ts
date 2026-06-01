import { Container, Text, TextStyle } from "pixi.js";

/**
 * LoadingTitle —— 组件类（最底层）
 *
 * 设计意图：把「底部署名标题」封装成一个独立的显示组件。
 * 它继承自 Container（容器），自身就是一个「显示对象组」，
 * 内部把一个 Text 文本对象作为子节点挂载进来。
 *
 * 为什么继承 Container 而不是直接用 Text？
 *  - 组件化：未来标题若要加副标题、下划线、背景条，只需往这个容器里 addChild，
 *    对外暴露的依然是同一个 LoadingTitle 节点，调用方无需改动。
 *  - 层级解耦：场景类只管「把组件摆在哪」，组件类只管「自己内部长什么样」。
 */
export class LoadingTitle extends Container {
  constructor() {
    super();

    // Text：PixiJS 的文本显示对象。
    // 底层机制：它会先把字符串用样式光栅化（rasterize）成一张纹理(Texture)，
    // 再像 Sprite 一样上传到 GPU 渲染 —— 所以频繁改文字内容会触发重新生成纹理。
    const title = new Text({
      text: "Simple Game develop & design by Hellocode",
      style: new TextStyle({
        fill: "#5a5a5a", // 设计稿中是黑底上的低饱和灰色
        fontSize: 18,
        fontWeight: "bold",
        fontFamily: '"Courier New", monospace', // 等宽字体，贴近像素风
        letterSpacing: 4, // 字间距，还原设计稿里被拉开的字距
        align: "center",
      }),
    });

    // 锚点(anchor)设为中心：让 (0,0) 落在文字几何中心，方便外部按中心点定位
    title.anchor.set(0.5);

    // addChild：把 Text 挂到当前容器，形成 LoadingTitle → Text 的层级嵌套
    this.addChild(title);
  }
}
