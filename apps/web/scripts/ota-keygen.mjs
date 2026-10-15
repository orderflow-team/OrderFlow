// Generates the OTA signing key pair. Run it once, on a trusted machine:
//   node scripts/ota-keygen.mjs
//
// - The PRIVATE key signs releases. Keep it offline / in a password manager and in the
//   CI secret OTA_SIGNING_PRIVATE_KEY. It must never be set on the API server.
// - The PUBLIC key goes into the apps (NEXT_PUBLIC_OTA_PUBLIC_KEY, a GitHub variable used by
//   every build) and onto the API (OTA_PUBLIC_KEY) so uploads are checked at the door.
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const privateB64 = Buffer.from(privatePem, 'utf8').toString('base64');

console.log('PUBLIC key (safe to share) -> NEXT_PUBLIC_OTA_PUBLIC_KEY (apps) and OTA_PUBLIC_KEY (API):\n');
console.log(publicB64);
console.log('\nPRIVATE key (secret) -> OTA_SIGNING_PRIVATE_KEY on the release machine / CI secret ONLY.');
console.log('One-line form (base64 of the PEM), easiest to paste into a CI secret:\n');
console.log(privateB64);
console.log('\nBack the private key up somewhere safe: if it is lost, apps already installed can only be');
console.log('moved to a new key by shipping a new APK, because they trust only the key they were built with.');
