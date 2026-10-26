import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { openDB } from 'idb';
import { initialData } from '../src/domain/state';
import { loadData, saveData } from '../src/services/storage';
describe('device persistence', () => {
  it('recovers saved data and preserves the old state when a write is rejected', async () => {
    const d = initialData(); d.library.words = [{char:'天',enabled:true}]; await saveData(d); expect(await loadData()).toEqual(d);
    await expect(saveData({...d,math:{...d.math,numbers:[]}})).rejects.toThrow(); expect(await loadData()).toEqual(d);
    const put = vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(() => { throw new DOMException('full','QuotaExceededError'); });
    await expect(saveData({...d,voice:{autoRead:false,rate:.7}})).rejects.toThrow(); put.mockRestore(); expect(await loadData()).toEqual(d);
  });
  it('surfaces corrupt stored data rather than replacing it with defaults', async () => { const db = await openDB('little-explorer',1); await db.put('app',{version:99},'state'); await expect(loadData()).rejects.toThrow(); expect(await db.get('app','state')).toEqual({version:99}); });
});
