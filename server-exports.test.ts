import assert from 'node:assert/strict';
import test from 'node:test';
import { csvCell } from './server-exports.ts';

test('CSV fields quote delimiters and neutralize spreadsheet formulas', () => {
  assert.equal(csvCell('hello, "world"'), '"hello, ""world"""');
  assert.equal(csvCell('=HYPERLINK("https://bad.example")'), '"\'=HYPERLINK(""https://bad.example"")"');
  assert.equal(csvCell('  @SUM(A1:A2)'), '"\'  @SUM(A1:A2)"');
  assert.equal(csvCell('line one\r\nline two'), '"line one line two"');
});