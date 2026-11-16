export function assetUrl(path: string) {
  return new URL(import.meta.env.BASE_URL + path, document.baseURI).href;
}
