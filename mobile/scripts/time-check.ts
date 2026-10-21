// Typed times in the time pickers (src/lib/timeText.ts). Run: npm run check:time
import assert from 'node:assert/strict';
import { parseTime } from '../src/lib/timeText';

assert.equal(parseTime('17:04'), '17:04');
assert.equal(parseTime('1704'), '17:04');
assert.equal(parseTime('7:04'), '07:04');
assert.equal(parseTime('704'), '07:04');
assert.equal(parseTime(' 08:30 '), '08:30');
assert.equal(parseTime('00:00'), '00:00');
assert.equal(parseTime('23:59'), '23:59');
assert.equal(parseTime('24:00'), null, 'no hour 24');
assert.equal(parseTime('12:60'), null, 'no minute 60');
assert.equal(parseTime('7'), null);
assert.equal(parseTime('abc'), null);
assert.equal(parseTime(''), null);
console.log('typed times: all checks passed');
