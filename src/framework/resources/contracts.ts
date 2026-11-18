export interface ResourceAsset {
  src: string;
  type?: "pixi" | "json" | "font";
  optional?: boolean;
  family?: string;
  weight?: string;
}
export interface ResourceManifest {
  brand?: string;
  version?: string;
  base?: string;
  concurrency?: number;
  retries?: number;
  assets: Record<string, ResourceAsset>;
  bundles: Record<string, { assets: string[]; dependsOn?: string[] }>;
  startup?: string[];
}
export interface ResourceDriver {
  load(asset: ResourceAsset, url: string): Promise<unknown>;
  unload(asset: ResourceAsset, url: string, value: unknown): Promise<void>;
}
