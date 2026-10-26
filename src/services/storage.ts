import { openDB } from 'idb';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { initialData, validateData, type AppData } from '../domain/state';
const db = () => openDB('little-explorer', 1, { upgrade(database) { database.createObjectStore('app'); } });
export async function loadData(): Promise<AppData> { const database = await db(); const saved = await database.get('app', 'state'); return saved === undefined ? initialData() : validateData(saved); }
export async function saveData(data: AppData) { const clean = validateData(data); const database = await db(); await database.put('app', clean, 'state'); }
export async function exportBackup(data: AppData) {
  const json = JSON.stringify({ app: 'little-explorer', exportedAt: new Date().toISOString(), data: validateData(data) });
  const filename = `little-explorer-${new Date().toISOString().slice(0,10)}.json`;
  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: '小小探索家备份', url: file.uri, dialogTitle: '保存学习数据备份' });
  } else {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
export async function readBackup(file: File) {
  if (file.size > 100 * 1024 * 1024) throw Error('备份文件不能超过 100 MB');
  const value = JSON.parse(await file.text());
  if (value.app !== 'little-explorer') throw Error('请选择小小探索家导出的备份');
  return validateData(value.data);
}
export async function compressPhoto(file: File): Promise<string> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('请选择 JPG、PNG 或 WebP 图片');
  if (file.size > 10 * 1024 * 1024) throw Error('图片不能超过 10 MB');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw Error('图片无法读取');
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 640;
    const context = canvas.getContext('2d'); if (!context) throw Error('暂时无法处理图片');
    context.fillStyle = '#fff'; context.fillRect(0,0,640,640);
    const ratio = Math.min(640 / img.naturalWidth, 640 / img.naturalHeight);
    const w = img.naturalWidth * ratio, h = img.naturalHeight * ratio;
    context.drawImage(img,(640-w)/2,(640-h)/2,w,h);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}
