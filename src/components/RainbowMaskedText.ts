import {
  Application,
  Container,
  Sprite,
  Text,
  TextStyle,
  Texture,
  TilingSprite,
} from "pixi.js";
import { createRainbowTexture } from "../resources/createRainbowTexture";

type ShadowLayer = {
  color: number;
  x: number;
  y: number;
};

type RainbowMaskedTextOptions = {
  text: string;
  fontSize: number;
  fontFamily?: string;
  letterSpacing?: number;
  speed?: number;
  materialTexture?: Texture;
  shadows?: ShadowLayer[];
};

export class RainbowMaskedText extends Container {
  private readonly material: TilingSprite;
  private readonly maskSprite: Sprite;
  private readonly flowSpeed: number;

  constructor(app: Application, options: RainbowMaskedTextOptions) {
    super();

    const textTexture = RainbowMaskedText.createTextTexture(app, options);
    const textureWidth = textTexture.width;
    const textureHeight = textTexture.height;

    options.shadows?.forEach((layer) => {
      const shadow = new Sprite({
        texture: textTexture,
        anchor: 0.5,
        roundPixels: true,
      });
      shadow.tint = layer.color;
      shadow.position.set(layer.x, layer.y);
      this.addChild(shadow);
    });

    this.material = new TilingSprite({
      texture: options.materialTexture ?? createRainbowTexture(),
      width: textureWidth,
      height: textureHeight,
      anchor: 0.5,
      tileScale: { x: 1, y: 1 },
      roundPixels: true,
    });

    this.maskSprite = new Sprite({
      texture: textTexture,
      anchor: 0.5,
      roundPixels: true,
    });
    this.maskSprite.renderable = false;

    this.material.setMask({
      mask: this.maskSprite,
      channel: "alpha",
    });

    this.flowSpeed = options.speed ?? 0.8;
    this.addChild(this.material, this.maskSprite);
  }

  update(deltaTime: number): void {
    this.material.tilePosition.y += this.flowSpeed * deltaTime;
  }

  private static createTextTexture(
    app: Application,
    options: RainbowMaskedTextOptions
  ): Texture {
    const text = new Text({
      text: options.text,
      style: new TextStyle({
        fill: "#ffffff",
        fontFamily:
          options.fontFamily ?? '"Arial Black", Impact, "Courier New", sans-serif',
        fontSize: options.fontSize,
        fontWeight: "900",
        letterSpacing: options.letterSpacing ?? 0,
        padding: 8,
      }),
    });

    return app.renderer.generateTexture({
      target: text,
      resolution: Math.max(2, window.devicePixelRatio || 1),
      antialias: false,
    });
  }

}
