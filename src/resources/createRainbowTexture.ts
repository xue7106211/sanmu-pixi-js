import { Texture } from "pixi.js";

export function createRainbowTexture(): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 192;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Texture.WHITE;
  }

  ctx.imageSmoothingEnabled = false;
  const stripes = [
    "#ff3b30",
    "#ff8a00",
    "#ffe33b",
    "#28d66f",
    "#2a8cff",
    "#7d3cff",
    "#ff3b8a",
    "#ff5b2e",
  ];
  const stripeHeight = canvas.height / stripes.length;

  stripes.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, index * stripeHeight, canvas.width, stripeHeight + 1);
  });

  for (let y = 0; y < canvas.height; y += 12) {
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(0, y, canvas.width, 3);
  }

  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  return texture;
}
