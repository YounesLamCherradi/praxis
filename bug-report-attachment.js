const MAX_BUG_REPORT_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const ALLOWED_BUG_REPORT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function sanitizeAttachmentName(value, mimeType) {
  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const fallback = `screenshot.${extensions[mimeType]}`;
  const normalized = String(value || fallback)
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return normalized || fallback;
}

function matchesImageSignature(buffer, mimeType) {
  if (mimeType === 'image/png') {
    return buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

function decodeBugReportAttachment(attachment) {
  if (attachment == null) return null;
  if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)) {
    throw new Error('Invalid screenshot.');
  }

  const mimeType = String(attachment.type || '').toLowerCase();
  if (!ALLOWED_BUG_REPORT_MIME_TYPES.has(mimeType)) {
    throw new Error('Screenshot must be a PNG, JPEG, or WebP image.');
  }

  const dataUrl = String(attachment.dataUrl || '');
  const match = /^data:([^;,]+);base64,([a-zA-Z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match || match[1].toLowerCase() !== mimeType) {
    throw new Error('Invalid screenshot data.');
  }

  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw new Error('Screenshot is empty.');
  if (!matchesImageSignature(buffer, mimeType)) {
    throw new Error('Screenshot content does not match its image type.');
  }
  if (buffer.length > MAX_BUG_REPORT_ATTACHMENT_BYTES) {
    throw new Error('Screenshot must be 3 MB or smaller.');
  }

  const declaredSize = Number(attachment.size);
  if (Number.isFinite(declaredSize) && declaredSize >= 0 && declaredSize !== buffer.length) {
    throw new Error('Screenshot size does not match its data.');
  }

  return {
    buffer,
    mimeType,
    name: sanitizeAttachmentName(attachment.name, mimeType),
    size: buffer.length,
  };
}

module.exports = {
  MAX_BUG_REPORT_ATTACHMENT_BYTES,
  decodeBugReportAttachment,
};
