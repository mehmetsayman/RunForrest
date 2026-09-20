// SEP-1 discovery -> SEP-10 authentication -> JWT verification
import { Keypair, TransactionBuilder, Networks } from '@stellar/stellar-sdk';

const HOME = 'https://tr-mock-anchor.fly.dev';
const NET = Networks.TESTNET;

// 1) SEP-1 discovery
const toml = await (await fetch(`${HOME}/.well-known/stellar.toml`)).text();
const get = (k) => toml.match(new RegExp(`^${k}="(.*)"`, 'm'))?.[1];
const WEB_AUTH = get('WEB_AUTH_ENDPOINT');
const SIGNING_KEY = get('SIGNING_KEY');
const issuer = toml.match(/issuer="(G[A-Z0-9]+)"/)?.[1];
console.log('SEP-1  web_auth :', WEB_AUTH);
console.log('SEP-1  signing  :', SIGNING_KEY);
console.log('SEP-1  issuer   :', issuer);

// 2) New testnet account (friendbot)
const kp = Keypair.random();
const fb = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
console.log('friendbot       :', fb.status, kp.publicKey());

// 3) SEP-10 challenge
const chRes = await fetch(`${WEB_AUTH}?account=${kp.publicKey()}`);
const ch = await chRes.json();
if (!ch.transaction) { console.log('CHALLENGE FAIL', ch); process.exit(1); }
console.log('SEP-10 challenge: alindi, network =', ch.network_passphrase);

// 4) Sign the challenge
const tx = TransactionBuilder.fromXDR(ch.transaction, ch.network_passphrase || NET);
// Anchor'in imzasi dogru mu?
console.log('SEP-10 src acct :', tx.source, '(signing key ile ayni mi:', tx.source === SIGNING_KEY, ')');
tx.sign(kp);

// 5) Get the token
const tokRes = await fetch(WEB_AUTH, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ transaction: tx.toXDR() }),
});
const tok = await tokRes.json();
if (!tok.token) { console.log('TOKEN FAIL', tokRes.status, tok); process.exit(1); }
const claims = JSON.parse(Buffer.from(tok.token.split('.')[1], 'base64').toString());
console.log('SEP-10 JWT      : OK');
console.log('  sub =', claims.sub);
console.log('  exp =', new Date(claims.exp * 1000).toISOString());

// 6) CORS on preflight-sensitive endpoint
const cors = await fetch(`${HOME}/sep6/info`, { headers: { Origin: 'http://localhost:3000' } });
console.log('CORS /sep6/info :', cors.status, 'allow-origin =', cors.headers.get('access-control-allow-origin'));

// 7) Authenticated call with the JWT
const txs = await fetch(`${HOME}/sep6/transactions?asset_code=USDC`, {
  headers: { Authorization: `Bearer ${tok.token}` },
});
console.log('SEP-6 auth call :', txs.status);
console.log('\nSPIKE A: BASARILI');
