import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { ProposalBackend, ProposalError } from '../server/proposal-backend.ts';
import { tavern } from '../src/games/tavern/definition.ts';
const folder = mkdtempSync(join(tmpdir(), 'm1-examples-'));
const file = join(folder, 'backend.json');
let backend = new ProposalBackend([tavern], file, { rng: () => 0.5 });
const examples = [];
const auth = { sessionId: '', token: '', playToken: '' };
const call = (name, path, payload, note) => {
 const body = { gameCode: 'tavern-drop', ...payload };
 const headers = path === '/login' ? {} : { 'Session-Id': auth.sessionId, Authorization: `Bearer ${auth.token}`, ...(auth.playToken ? { 'Play-Token': auth.playToken } : {}) };
 let response, status = 200;
 try { response = backend.handle('POST', path, body, auth); }
 catch (error) { if (!(error instanceof ProposalError)) throw error; status = error.status; response = { error: error.message, synthetic: true }; }
 examples.push({ name, note, request: { method: 'POST', path: `/api/v1${path}`, headers, body }, response: { status, body: response } });
 if (path === '/login' && status === 200) Object.assign(auth, { sessionId: response.sessionId, token: response.token, playToken: '' });
 return response;
};
try {
 call('session.init', '/login', { userId: 'synthetic-m1-normal' }, 'Synthetic identity; real launch-token authentication is owned by A.');
 let info = call('game.info', '/game-info', {}, 'Settings, currency and confirmed wallet before a wager.'); auth.playToken = info.playToken;
 const normal = call('normal.win', '/spin', { isFreespin: 0, betMinor: 1000, chanceMode: 'normal' }, 'BE confirms chargedMinor and totalwin_amt. No feature settlement is split into per-spin credits.');
 assert.ok(normal.totalwin_amt > 0 && !normal.freegame);
 const duplicate = call('normal.duplicate', '/spin', { isFreespin: 0, betMinor: 1000, chanceMode: 'normal' }, 'Same Play-Token and payload return the recorded result, without another wager.');
 assert.deepEqual(normal, duplicate);
 call('normal.status', '/rounds/status', {}, 'Read-only payment/round status; no new wager or presentation ACK.');
 call('feature.init', '/login', { userId: 'synthetic-m1-feature' }, 'Separate synthetic player for the feature example.');
 info = call('feature.info', '/game-info', {}); auth.playToken = info.playToken;
 let step = call('feature.buy', '/buy-feature', { betMinor: 1000, featureMode: 'drop' }, 'Purchase price differs from original base bet. Multipliers are dimensionless. Outcome is persisted before response.');
 step = call('feature.intro.complete', '/spin', { isFreespin: 1, curStep: 'intro', stepId: step.stepId }, 'Only send after intro was presented. This ACK releases the first free spin. It does not create a bet.');
 backend = new ProposalBackend([tavern], file, { rng: () => 0.5 });
 call('resume.reconnect.login', '/login', { userId: 'synthetic-m1-feature' }, 'Restarted mock process reads the same persistent round.');
 call('resume.mid-feature', '/game-info', {}, 'Issued free spin remains the same. Snapshot is after-result; show_stored_result does not restart completed free spins.');
 step = call('feature.free-spin.complete', '/spin', { isFreespin: 1, curStep: 'freespin', stepId: step.stepId, kind: 'shown_as_result' }, 'Differentiate server-released result from FE-confirmed presentation. ACK once per meaningful step.');
 while (step.freegame?.curStep === 'freespin') step = backend.handle('POST', '/spin', { gameCode: 'tavern-drop', isFreespin: 1, curStep: 'freespin', stepId: step.stepId }, auth);
 examples.push({ name: 'feature.chest-summary.released', note: 'Intermediate free-spin ACKs omitted for brevity; released by the preceding ACK.', response: { status: 200, body: step } });
 if (step.freegame?.curStep === 'show-chest') step = call('feature.chest-summary.complete', '/spin', { isFreespin: 1, curStep: 'show-chest', stepId: step.stepId });
 if (step.freegame?.curStep === 'open-chest') {
  call('resume.mid-chest', '/game-info', {}, 'Only the unfinished chest step may replay from its safe boundary.');
  step = call('feature.first-chest.complete', '/spin', { isFreespin: 1, curStep: 'open-chest', stepId: step.stepId }, 'Response confirms the next chest and authoritative displayed total.');
 }
 while (step.freegame?.curStep === 'open-chest') step = backend.handle('POST', '/spin', { gameCode: 'tavern-drop', isFreespin: 1, curStep: 'open-chest', stepId: step.stepId }, auth);
 assert.equal(step.freegame?.curStep, 'free-end');
 examples.push({ name: 'feature.final-result.released', note: 'Recorded final result; wallet confirmation is separate from accumulated presentation win.', response: { status: 200, body: step } });
 call('feature.before-settlement.status', '/rounds/status', {});
 const finalBody = { isFreespin: 1, curStep: 'free-end', stepId: step.stepId };
 const final = call('feature.total-win.complete', '/spin', finalBody, 'In this mock the final ACK settles once. Server expiry settlement also operates without a returning browser. A must approve production credit timing.');
 const retry = call('feature.final-ack.duplicate', '/spin', finalBody, 'Lost-response retry returns the same receipt without another credit.'); assert.deepEqual(final, retry);
 call('feature.after-settlement.status', '/rounds/status', {});
 call('error.missing-play-token', '/spin', { isFreespin: 0, betMinor: -1, chanceMode: 'normal' }, 'No Play-Token after reconnect: structured rejection; never treat ambiguous network loss as a confirmed rejected wager.');
 const replacements = new Map();
 const sanitize = (value, key = '') => {
  if (Array.isArray(value)) return value.map((v) => sanitize(v));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,sanitize(v,k)]));
  if (typeof value === 'string' && (['token', 'playToken', 'Authorization', 'Play-Token', 'Session-Id', 'sessionId'].includes(key) || /^[a-f0-9-]{36}$/i.test(value))) {
   const bearer = value.startsWith('Bearer '); const raw = bearer ? value.slice(7) : value;
   if (!replacements.has(raw)) replacements.set(raw, `synthetic-id-${String(replacements.size + 1).padStart(3,'0')}`);
   return (bearer ? 'Bearer ' : '') + replacements.get(raw);
  }
  return value;
 };
 const output = { contract: 'local-v1-review-6', synthetic: true, currency: 'KRW', currencyExponent: 0, note: 'Generated from ProposalBackend. Sanitized IDs are illustrative, not live credentials. Contract and production wallet semantics require review by A.', examples: sanitize(examples) };
 writeFileSync(resolve(process.argv[2] || 'docs/milestone-1-v1-examples.json'), JSON.stringify(output, null, 2) + '\n');
 console.log(`Generated ${examples.length} synthetic API examples.`);
} finally { rmSync(folder, { recursive: true, force: true }); }
