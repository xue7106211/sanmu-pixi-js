export type ResourcePhase = "loading" | "game";

export type ResourceMap = {
  loadingBootTexture: import("pixi.js").Texture;
  rainbowTextMaterial: import("pixi.js").Texture;
};

export type ResourceKey = keyof ResourceMap;

export type ResourceEntry<K extends ResourceKey = ResourceKey> = {
  key: K;
  phase: ResourcePhase;
  load: () => ResourceMap[K] | Promise<ResourceMap[K]>;
};

export type ResourceProgress = {
  phase: ResourcePhase;
  loaded: number;
  total: number;
  progress: number;
  key?: ResourceKey;
};

export class ResourceLoader {
  private readonly resources = new Map<ResourceKey, ResourceMap[ResourceKey]>();

  constructor(private readonly entries: ResourceEntry[]) {}

  async loadPhase(
    phase: ResourcePhase,
    onProgress?: (progress: ResourceProgress) => void
  ): Promise<void> {
    const entries = this.entries.filter((entry) => entry.phase === phase);
    const total = entries.length;

    if (total === 0) {
      onProgress?.({ phase, loaded: 0, total: 0, progress: 1 });
      return;
    }

    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      const resource = await entry.load();
      this.resources.set(entry.key, resource);

      onProgress?.({
        phase,
        key: entry.key,
        loaded: index + 1,
        total,
        progress: (index + 1) / total,
      });
    }
  }

  get<K extends ResourceKey>(key: K): ResourceMap[K] {
    const resource = this.resources.get(key);
    if (!resource) {
      throw new Error(`资源尚未加载: ${key}`);
    }

    return resource as ResourceMap[K];
  }
}
