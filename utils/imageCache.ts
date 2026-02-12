// In-memory cache to avoid passing large data (base64 images, JSON) through navigation params
const cache = new Map<string, any>();
let counter = 0;

export function storeImage(imageUri: string): string {
  if (!imageUri.startsWith('data:')) return imageUri;
  const key = `img_${++counter}`;
  cache.set(key, imageUri);
  return key;
}

export function getImage(keyOrUri: string): string {
  return cache.get(keyOrUri) || keyOrUri;
}

export function storeData(data: any): string {
  const key = `data_${++counter}`;
  cache.set(key, data);
  return key;
}

export function getData<T = any>(key: string): T | null {
  return cache.get(key) || null;
}

export function removeCache(key: string): void {
  cache.delete(key);
}
