const crypto = require('crypto');

const V = '1v';
const VL = V.length;
// const ALG = 'AES-256-CFB';
// const B = 32;
const ALG = 'BF-CFB';
const B = 16;

const secret = (key) => {
  if (!key) throw 'Secret not defined';

  return crypto
    .createHash('sha256')
    .update(key)
    .digest('base64')
    .substr(0, B);
}

const res = (cipher, text, decipher = false) => {
  const from = decipher ? 'base64' : 'utf8';
  const to = decipher ? 'utf8' : 'base64';
  return cipher.update(text, from, to) + cipher.final(to);
}

const encrypt = (text, key) => {
  const iv = crypto.randomBytes(B / 2);
  const cipher = crypto.createCipheriv(ALG, secret(key), iv);
  return V + iv.toString('hex') + res(cipher, text);
}

const decrypt = (text, key) => {
  const v = text.substring(0, VL);
  if (v != V) throw 'Secret version not supported';

  const iv = Buffer.from(text.substring(VL, VL + B), 'hex');
  const encrypted = text.substring(VL + B);
  const decipher = crypto.createDecipheriv(ALG, secret(key), iv);
  return res(decipher, encrypted, true);
}

module.exports = {
  V,
  encrypt,
  decrypt,
};
