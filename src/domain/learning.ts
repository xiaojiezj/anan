// Learning rules rebuilt from the supplied mota project; independent of UI and device APIs.
export const DEFAULT_WORDS = [...'日月水火山石田土人口手木'];
export const DURATIONS = [5, 10, 15, 20];
export type Library = { words: { char: string; enabled: boolean }[]; seconds: number; waveSeconds: number };
export const newLibrary = (): Library => ({ words: DEFAULT_WORDS.map(char => ({ char, enabled: true })), seconds: 10, waveSeconds: 5 });
export function parseWords(value: string) {
  const chars = [...new Set([...value.replace(/[\s,，、;；。]/g, '')])];
  if (!chars.length) throw Error('请输入要学习的汉字');
  if (chars.some(char => !/^\p{Unified_Ideograph}$/u.test(char) && char !== '〇')) throw Error('请只输入汉字，多个字会自动拆分');
  return chars;
}
export function validateLibrary(data: Library): Library {
  if (!data || !Array.isArray(data.words) || data.words.length > 100 || !DURATIONS.includes(data.seconds)
    || !Number.isInteger(data.waveSeconds) || data.waveSeconds < 1 || data.waveSeconds > 20 || data.seconds < data.waveSeconds) throw Error('识字配置不正确：每字时长不能短于地鼠停留时间');
  const seen = new Set<string>();
  for (const word of data.words) {
    if (!word || typeof word.char !== 'string' || [...word.char].length !== 1 || typeof word.enabled !== 'boolean' || seen.has(word.char)) throw Error('字库数据不正确');
    parseWords(word.char); seen.add(word.char);
  }
  return structuredClone(data);
}
export function addWords(library: Library, value: string) {
  const chars = parseWords(value).filter(char => !library.words.some(w => w.char === char));
  if (chars.length + library.words.length > 100) throw Error('字库最多保存 100 个字');
  return validateLibrary({ ...library, words: [...library.words, ...chars.map(char => ({ char, enabled: true }))] });
}
export function editWord(library: Library, old: string, value: string) {
  const chars = parseWords(value);
  if (chars.length !== 1) throw Error('每项只能填写一个汉字');
  if (chars[0] !== old && library.words.some(w => w.char === chars[0])) throw Error('字库里已经有这个字了');
  return validateLibrary({ ...library, words: library.words.map(w => w.char === old ? { ...w, char: chars[0] } : w) });
}
export function shuffle<T>(list: T[], random = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
export type MoleGame = {
  targets: string[]; pool: string[]; seconds: number; waveMs: number; index: number; score: number; mistakes: number;
  results: { char: string; hits: number; mistakes: number }[]; pausedAt: number | null; finished: boolean;
  wave: number; target: string; deadline: number; nextWave: number; roundHits: number; roundMistakes: number;
  moles: ({ char: string; hit: boolean } | null)[]; feedback: { slot: number; correct: boolean; until: number } | null;
};
function spawn(game: MoleGame, now: number, random: () => number) {
  const choices = [game.target, ...shuffle(game.pool.filter(c => c !== game.target), random).slice(0, 2)];
  const holes = shuffle([0,1,2,3,4,5,6,7,8], random);
  game.moles = Array(9).fill(null);
  choices.forEach((char, i) => { game.moles[holes[i]] = { char, hit: false }; });
  game.wave++;
  const next = now + game.waveMs;
  game.nextWave = game.deadline - next < game.waveMs ? game.deadline : next;
}
function beginRound(game: MoleGame, now: number, random: () => number) {
  game.target = game.targets[game.index]; game.deadline = now + game.seconds * 1000;
  game.roundHits = 0; game.roundMistakes = 0; game.feedback = null; spawn(game, now, random);
}
export function newMoleGame(library: Library, now = Date.now(), random = Math.random): MoleGame {
  validateLibrary(library);
  const chars = library.words.filter(w => w.enabled).map(w => w.char);
  if (!chars.length) throw Error('先在字库里选择至少一个汉字');
  const game: MoleGame = { targets: shuffle(chars, random), pool: [...new Set([...chars, ...DEFAULT_WORDS])], seconds: library.seconds,
    waveMs: library.waveSeconds * 1000, index: 0, score: 0, mistakes: 0, results: [], pausedAt: null, finished: false,
    wave: 0, target: '', deadline: 0, nextWave: 0, roundHits: 0, roundMistakes: 0, moles: [], feedback: null };
  beginRound(game, now, random); return game;
}
export function advanceGame(game: MoleGame, now = Date.now(), random = Math.random) {
  if (game.finished || game.pausedAt !== null) return;
  if (now >= game.deadline) {
    game.results.push({ char: game.target, hits: game.roundHits, mistakes: game.roundMistakes }); game.index++;
    if (game.index >= game.targets.length) game.finished = true;
    else beginRound(game, now, random);
  } else if (now >= game.nextWave) spawn(game, now, random);
}
export function hitMole(game: MoleGame, slot: number, wave: number, now = Date.now()): boolean | null {
  if (game.finished || game.pausedAt !== null || now >= game.deadline || now >= game.nextWave || game.wave !== wave) return null;
  const mole = game.moles[slot];
  if (!mole || mole.hit) return null;
  mole.hit = true;
  const correct = mole.char === game.target;
  if (correct) { game.score++; game.roundHits++; } else { game.mistakes++; game.roundMistakes++; }
  game.feedback = { slot, correct, until: now + 1000 }; return correct;
}
export function pauseGame(game: MoleGame, now = Date.now()) { if (!game.finished && game.pausedAt === null) game.pausedAt = now; }
export function resumeGame(game: MoleGame, now = Date.now()) {
  if (game.finished || game.pausedAt === null) return;
  const elapsed = now - game.pausedAt; game.deadline += elapsed; game.nextWave += elapsed;
  if (game.feedback) game.feedback.until += elapsed; game.pausedAt = null;
}
export const VEHICLES = [
  { id: 'car', name: '小汽车', unit: '辆', emoji: '🚗' }, { id: 'bus', name: '公交车', unit: '辆', emoji: '🚌' },
  { id: 'train', name: '小火车', unit: '列', emoji: '🚂' }, { id: 'truck', name: '小货车', unit: '辆', emoji: '🚚' },
  { id: 'boat', name: '小轮船', unit: '艘', emoji: '⛵' }, { id: 'plane', name: '小飞机', unit: '架', emoji: '✈️' },
];
export type MathConfig = { numbers: number[]; operation: 'add' | 'subtract' | 'mixed'; rounds: number; vehicles: string[] };
export const defaultMath = (): MathConfig => ({ numbers: Array.from({ length: 10 }, (_, i) => i + 1), operation: 'mixed', rounds: 5, vehicles: VEHICLES.map(v => v.id) });
export function validateMath(c: MathConfig): MathConfig {
  if (!c || !Array.isArray(c.numbers) || !c.numbers.length || c.numbers.length > 21 || c.numbers.some(n => !Number.isInteger(n) || n < 0 || n > 20) || new Set(c.numbers).size !== c.numbers.length) throw Error('请选择 0–20 中至少一个数字');
  if (!['mixed', 'add', 'subtract'].includes(c.operation) || ![5,10].includes(c.rounds)) throw Error('数学配置不正确');
  if (!Array.isArray(c.vehicles) || !c.vehicles.length || c.vehicles.length > 6 || new Set(c.vehicles).size !== c.vehicles.length || c.vehicles.some(id => !VEHICLES.some(v => v.id === id))) throw Error('请至少选择一种交通工具');
  return { ...c, numbers: [...c.numbers].sort((a, b) => a-b), vehicles: [...c.vehicles] };
}
export type Equation = { a: number; b: number; op: '+' | '−'; answer: number };
export function equationPool(config: MathConfig) {
  const pool: Equation[] = []; const numbers = new Set(config.numbers);
  for (const a of config.numbers) for (const b of config.numbers) {
    if (config.operation !== 'subtract' && numbers.has(a+b)) pool.push({ a, b, op: '+', answer: a+b });
    if (config.operation !== 'add' && a >= b && numbers.has(a-b)) pool.push({ a, b, op: '−', answer: a-b });
  }
  return pool;
}
export type MathQuestion = { answer: number; a?: number; b?: number; op?: '+' | '−'; choices: number[]; vehicle: string };
export type MathGame = { mode: 'count' | 'calculate'; questions: MathQuestion[]; index: number; firstTry: number; mistakes: number; counted: number[]; wrong: number[]; solved: boolean; finished: boolean };
export function newMathGame(value: MathConfig, mode: MathGame['mode'], random = Math.random): MathGame {
  const config = validateMath(value), pool = equationPool(config);
  if (mode === 'calculate' && !pool.length) throw Error('这些数字暂时组不成算式，请增加数字，或先玩认识数字');
  const vehicles = shuffle(config.vehicles, random), numbers = shuffle(config.numbers, random);
  const questions: MathQuestion[] = []; let available: Equation[] = [];
  for (let i = 0; i < config.rounds; i++) {
    let question: { answer: number } | Equation;
    if (mode === 'count') question = { answer: numbers[i % numbers.length] };
    else {
      const op = config.operation === 'mixed' ? (i % 2 ? '−' : '+') : config.operation === 'add' ? '+' : '−';
      if (!available.some(q => q.op === op)) available.push(...shuffle(pool.filter(q => q.op === op), random));
      const at = available.findIndex(q => q.op === op);
      question = at >= 0 ? available.splice(at, 1)[0] : pool[Math.floor(random() * pool.length)];
    }
    questions.push({ ...question, vehicle: vehicles[i % vehicles.length], choices: shuffle([question.answer, ...shuffle(config.numbers.filter(n => n !== question.answer), random).slice(0, 2)], random) });
  }
  return { mode, questions, index: 0, firstTry: 0, mistakes: 0, counted: [], wrong: [], solved: false, finished: false };
}
export function answerMath(game: MathGame, value: number, round: number): 'correct' | 'wrong' | 'ignored' {
  if (game.finished || game.solved || round !== game.index) return 'ignored';
  const q = game.questions[game.index];
  if (game.mode === 'calculate' && !q.choices.includes(value)) return 'ignored';
  if (game.wrong.includes(value)) return 'ignored';
  if (value !== q.answer) { game.wrong.push(value); game.mistakes++; return 'wrong'; }
  game.solved = true; if (!game.wrong.length) game.firstTry++;
  if (game.mode === 'count') game.counted = Array.from({ length: q.answer }, (_, i) => i);
  return 'correct';
}
export function countVehicle(game: MathGame, index: number, round: number) {
  const q = game.questions[game.index];
  if (game.finished || game.mode !== 'count' || game.solved || round !== game.index || !Number.isInteger(index) || index < 0 || index >= q.answer || game.counted.includes(index)) return false;
  game.counted.push(index);
  if (game.counted.length === q.answer) { game.solved = true; if (!game.wrong.length) game.firstTry++; } return true;
}
export function nextMath(game: MathGame) {
  if (!game.solved || game.finished) return false;
  game.index++; if (game.index === game.questions.length) game.finished = true;
  else { game.counted = []; game.wrong = []; game.solved = false; } return true;
}
