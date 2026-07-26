const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_BUG_REPORT_ATTACHMENT_BYTES,
  decodeBugReportAttachment,
} = require('../bug-report-attachment');

test('decodes a supported report screenshot and sanitizes its name', () => {
  const bytes = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from('fake png bytes'),
  ]);
  const result = decodeBugReportAttachment({
    name: '../../broken screen.png',
    type: 'image/png',
    size: bytes.length,
    dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
  });

  assert.deepEqual(result.buffer, bytes);
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.name, '..-..-broken-screen.png');
  assert.equal(result.size, bytes.length);
});

test('rejects unsupported screenshot types and mismatched sizes', () => {
  const bytes = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from('image'),
  ]);
  assert.throws(
    () => decodeBugReportAttachment({
      name: 'screen.gif',
      type: 'image/gif',
      size: bytes.length,
      dataUrl: `data:image/gif;base64,${bytes.toString('base64')}`,
    }),
    /PNG, JPEG, or WebP/
  );
  assert.throws(
    () => decodeBugReportAttachment({
      name: 'screen.png',
      type: 'image/png',
      size: bytes.length + 1,
      dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
    }),
    /size does not match/
  );
});

test('rejects screenshots larger than the storage limit', () => {
  const bytes = Buffer.alloc(MAX_BUG_REPORT_ATTACHMENT_BYTES + 1);
  bytes.write('RIFF', 0, 'ascii');
  bytes.write('WEBP', 8, 'ascii');
  assert.throws(
    () => decodeBugReportAttachment({
      name: 'screen.webp',
      type: 'image/webp',
      size: bytes.length,
      dataUrl: `data:image/webp;base64,${bytes.toString('base64')}`,
    }),
    /3 MB or smaller/
  );
});

test('rejects a file whose contents do not match its declared image type', () => {
  const bytes = Buffer.from('not really an image');
  assert.throws(
    () => decodeBugReportAttachment({
      name: 'screen.png',
      type: 'image/png',
      size: bytes.length,
      dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
    }),
    /does not match its image type/
  );
});
