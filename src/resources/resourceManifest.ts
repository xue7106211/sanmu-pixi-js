import { Texture } from "pixi.js";
import { createRainbowTexture } from "./createRainbowTexture";
import type { ResourceEntry } from "./ResourceLoader";

export const resourceManifest: ResourceEntry[] = [
  {
    key: "loadingBootTexture",
    phase: "loading",
    load: () => Texture.WHITE,
  },
  {
    key: "rainbowTextMaterial",
    phase: "game",
    load: () => createRainbowTexture(),
  },
];
