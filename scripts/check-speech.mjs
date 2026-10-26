import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const speech = path.join(root, 'android/app/src/main/assets/speech');
const manifest = JSON.parse(await readFile(path.join(speech, 'manifest.json'), 'utf8'));
const sources = JSON.parse(await readFile(new URL('./speech-sources.json', import.meta.url), 'utf8'));
async function hash(file) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
}
for (const item of manifest.files) {
  const file = path.resolve(speech, item.path);
  if (!file.startsWith(speech + path.sep) || (await stat(file)).size !== item.size || await hash(file) !== item.sha256) {
    throw new Error(`Offline speech asset is missing or modified: ${item.path}. See docs/SPEECH_MODELS.md.`);
  }
}
const aar = sources.find(source => source.name.endsWith('.aar'));
if (await hash(path.join(root, 'android/app/libs', aar.name)) !== aar.sha256) throw new Error('Sherpa-ONNX AAR checksum mismatch');
console.log(`Offline speech verified: ${manifest.files.length} files, revision ${manifest.revision}, and ${aar.name}`);
