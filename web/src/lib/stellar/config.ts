/**
 * Stellar ağ yapılandırması.
 *
 * Tüm adresler canlı testnet'e karşı doğrulandı — bkz. docs/TEKNIK-NOTLAR.md
 */

import { Networks } from "@stellar/stellar-sdk";

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";

/** Anchor'ın SEP-1 home domain'i. Tüm endpoint'ler buradan keşfedilir. */
export const ANCHOR_HOME_DOMAIN = "tr-mock-anchor.fly.dev";

/**
 * Anchor'ın ramp ettiği varlık. Circle'ın testnet USDC issuer'ı.
 * SEP-1 toml'dan da okunuyor; burası sadece trustline kurarken kullanılan sabit.
 */
export const USDC_CODE = "USDC";
export const USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

/** USDC'nin Stellar Asset Contract adresi — Soroban kontratları bunu kullanır. */
export const USDC_SAC =
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

/** DeFindex — kendi vault'umuz bu factory'den oluşturuldu. */
export const DEFINDEX_FACTORY =
  "CDSCWE4GLNBYYTES2OCYDFQA2LLY4RBIAX6ZI32VSUXD7GO6HRPO4A32";
export const SOROSWAP_ROUTER =
  "CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD";

/**
 * Testnet'e deploy edilmiş kontratlarımız — bkz. deployments.json.
 * Uçtan uca doğrulandı: create → join → progress → finalize → claim.
 */
export const RUNFORREST_CHALLENGE_ID =
  process.env.NEXT_PUBLIC_RUNFORREST_CHALLENGE_ID ??
  "CAN4QVZURUX6OLBFC7IH2HQHQDUJDD72UBGJLXR67BKACWBQF4JVUWCM";
export const RUNFORREST_BADGE_ID =
  process.env.NEXT_PUBLIC_RUNFORREST_BADGE_ID ??
  "CBEMQGDLL2KNMBSINUSQM7QXMKAOMFIJDFQL27F3ZEWSRYA75WB3VCU6";
/** RunForrest Prize Vault — ödül havuzunun custody katmanı. */
export const RUNFORREST_VAULT_ID =
  process.env.NEXT_PUBLIC_RUNFORREST_VAULT_ID ??
  "CCHEMDA647SX2RPQ4FYQ3HLDXLVSREQSIAWXVQ2AYRMEHPQLVSGXASI7";

/** Anchor limitleri — /health ve /sep6/info'dan doğrulandı. */
export const ANCHOR_LIMITS = {
  minOnrampTry: 50,
  maxOnrampTry: 3000,
  minUsdc: 0.5,
  maxUsdc: 300,
  feePercent: 0.5,
} as const;

/** Challenge katılım ücreti. 10 USDC ≈ 500 TRY (anchor limitleri içinde). */
export const ENTRY_FEE_USDC = "10";

export const explorerTx = (hash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`;
export const explorerAccount = (pub: string) =>
  `https://stellar.expert/explorer/testnet/account/${pub}`;
export const explorerContract = (id: string) =>
  `https://stellar.expert/explorer/testnet/contract/${id}`;
