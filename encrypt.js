const { encrypt, decrypt } = require('./scripts/utils/crypto');

if (process.argv.length < 4) return console.error('Invalid arguments count. Expected 2 arguments: text & password');

const text = process.argv[2];
const pass = process.argv[3];
const secret = encrypt(text, pass);
if (decrypt(secret, pass) != text) return console.error('Encryption failed');

console.log('Encryption success', {
  text,
  pass,
  secret
})