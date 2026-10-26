import { defaultMath, newLibrary, validateLibrary, validateMath, type Library, type MathConfig } from './learning';
export type Product = { id: string; name: string; cost: number; image: string; createdAt: number };
export type Session = { id: string; kind: 'literacy' | 'count' | 'calculate'; score: number; total: number; at: number };
export type AppData = { version: 1; library: Library; math: MathConfig; products: Product[]; trash: Product[]; voice: { autoRead: boolean; rate: number }; history: Session[] };
export const initialData = (): AppData => ({ version: 1, library: newLibrary(), math: defaultMath(), products: [], trash: [], voice: { autoRead: true, rate: 0.85 }, history: [] });
export function validateProduct(p: Product): Product {
  if (!p || typeof p.name !== 'string' || !p.name.trim() || [...p.name.trim()].length > 24) throw Error('商品名称必填，最多 24 个字');
  if (!Number.isInteger(p.cost) || p.cost < 1 || p.cost > 999999) throw Error('奖励币请填写 1–999999 的整数');
  if (typeof p.image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.image) || p.image.length > 1500000) throw Error('请选择有效的商品图片');
  if (typeof p.id !== 'string' || !p.id || !Number.isFinite(p.createdAt)) throw Error('商品数据不完整');
  return { id: p.id, name: p.name.trim(), cost: p.cost, image: p.image, createdAt: p.createdAt };
}
export function validateData(data: AppData): AppData {
  if (!data || data.version !== 1 || !Array.isArray(data.products) || data.products.length > 100 || !Array.isArray(data.trash) || data.trash.length > 100) throw Error('备份格式不正确');
  const products = data.products.map(validateProduct), trash = data.trash.map(validateProduct);
  if (new Set([...products, ...trash].map(p => p.id)).size !== products.length + trash.length) throw Error('商品编号重复');
  if (!data.voice || typeof data.voice.autoRead !== 'boolean' || ![0.7, 0.85, 1].includes(data.voice.rate)) throw Error('语音配置不正确');
  if (!Array.isArray(data.history) || data.history.length > 500 || data.history.some(s => !s || typeof s.id !== 'string' || !['literacy', 'count', 'calculate'].includes(s.kind) || !Number.isFinite(s.at) || !Number.isInteger(s.score) || s.score < 0 || !Number.isInteger(s.total) || s.total < 1)) throw Error('练习记录不正确');
  return { version: 1, library: validateLibrary(data.library), math: validateMath(data.math), products, trash, voice: { ...data.voice }, history: data.history.map(s => ({ ...s })) };
}
export function upsertProduct(data: AppData, product: Product): AppData {
  const clean = validateProduct(product), old = data.products.some(p => p.id === clean.id);
  if (!old && data.products.length >= 100) throw Error('最多添加 100 件商品');
  return { ...data, products: old ? data.products.map(p => p.id === clean.id ? clean : p) : [clean, ...data.products] };
}
export function removeProduct(data: AppData, id: string): AppData {
  const product = data.products.find(p => p.id === id);
  if (!product) return data;
  return { ...data, products: data.products.filter(p => p.id !== id), trash: [product, ...data.trash].slice(0, 100) };
}
export function restoreProduct(data: AppData, id: string): AppData {
  const product = data.trash.find(p => p.id === id);
  if (!product) throw Error('商品已不在回收站中');
  if (data.products.length >= 100) throw Error('商品已满，请先移除其他商品');
  return { ...data, products: [product, ...data.products], trash: data.trash.filter(p => p.id !== id) };
}
export function parseNumberSpeech(text: string): number | null {
  if (/\d[.．]\d/.test(text)) return null;
  const normalized = text.trim().replace(/[，。！!,.？?\s]/g, '').replace(/^(答案是|答案|等于|一共有|共有|是)/, '').replace(/(辆车|个|辆|列|架|艘)?$/, '');
  if (/^(?:[0-9]|1[0-9]|20)$/.test(normalized)) return Number(normalized);
  const chinese = ['零','一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十'];
  if (normalized === '〇') return 0;
  if (normalized === '两') return 2;
  const at = chinese.indexOf(normalized); return at >= 0 ? at : null;
}
export function matchWordSpeech(text: string, target: string) {
  // Accept a single character or a short explicit answer, never arbitrary substrings/negations.
  const clean = text.replace(/[，。！!,.？?\s]/g, '').replace(/^(答案是|这是|这个字是|是)/, '');
  return clean === target;
}
