// The app must never make sound (or vibrate).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, appFiles } from './helpers.js';

const FORBIDDEN = [/\bnew Audio\s*\(/, /AudioContext/, /<audio\b/i, /\bvibrate\s*\(/, /\.(mp3|wav|ogg|m4a|aac|flac)\b/i];

test('no audio or vibration APIs in app files', () => {
  for (const file of appFiles().filter((f) => /\.(html|js|css|webmanifest)$/.test(f))) {
    const text = read(file);
    for (const pattern of FORBIDDEN) assert.ok(!pattern.test(text), `${file} matches ${pattern}`);
  }
});

test('no audio files shipped', () => {
  const audio = appFiles().filter((f) => /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f));
  assert.deepEqual(audio, []);
});
