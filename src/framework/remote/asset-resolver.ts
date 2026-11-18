export interface AssetEnvironment { baseUrl: string; locale?: string; brand?: string; version?: string }
/** URLs are data, never executable remote configuration. Relative atlas pages keep their parent URL. */
export function resolveResourceUrl(source: string, base: string, environment: AssetEnvironment) {
  const substitute = (value: string) => value.replaceAll("{locale}", encodeURIComponent(environment.locale ?? "en-US"))
    .replaceAll("{brand}", encodeURIComponent(environment.brand ?? "default"))
    .replaceAll("{version}", encodeURIComponent(environment.version ?? ""));
  const url = new URL(substitute(source), new URL(substitute(base || "./"), environment.baseUrl));
  if (!["http:", "https:"].includes(url.protocol)) throw Error("Unsupported resource protocol");
  return url.href;
}
