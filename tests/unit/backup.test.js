import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, parseBackup, planRestore, backupFileName } from '../../src/backup.js';
import { createRecipe } from '../../src/recipe.js';

test('backup round-trips every poster', async () => {
  const entries = [createRecipe(), createRecipe({ time: 'night' })].map((recipe) => ({ id: recipe.id, recipe, thumbnail: null, updatedAt: recipe.updatedAt }));
  const restored = parseBackup(await makeBackup(entries));
  assert.equal(restored.length, 2);
  assert.deepEqual(restored.map((r) => r.recipe), entries.map((e) => e.recipe));
});

test('files that are not backups are refused with a friendly message', () => {
  assert.throws(() => parseBackup('not json'), /not a poster backup/);
  assert.throws(() => parseBackup('{"hello":1}'), /not a poster backup/);
});

test('unsafe thumbnails are dropped', () => {
  const text = JSON.stringify({ format: 'alpine-postcard-maker-backup', version: 1, posters: [{ recipe: createRecipe(), thumbnail: 'javascript:alert(1)' }] });
  assert.equal(parseBackup(text)[0].thumbnail, null);
});

test('restore adds new posters, updates older copies, never overwrites newer work', () => {
  const a = createRecipe(); const b = createRecipe(); const c = createRecipe();
  const existing = [{ id: a.id, updatedAt: 100 }, { id: b.id, updatedAt: 500 }];
  const incoming = [
    { recipe: { ...a, updatedAt: 200 } }, // newer in backup → update
    { recipe: { ...b, updatedAt: 300 } }, // older in backup → keep phone copy
    { recipe: c },                        // new → add
  ];
  const plan = planRestore(existing, incoming);
  assert.deepEqual([plan.added, plan.updated, plan.unchanged], [1, 1, 1]);
  assert.deepEqual(plan.write.map((w) => w.recipe.id).sort(), [a.id, c.id].sort());
});

test('backup file name carries the date', () => {
  assert.equal(backupFileName(new Date('2026-09-26T10:00:00Z')), 'alpine-posters-backup-2026-09-26.json');
});
