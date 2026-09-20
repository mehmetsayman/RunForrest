/**
 * Stellar network configuration.
 *
 * Every address was verified against live testnet — see docs/TECHNICAL-NOTES.md
 */

import { Networks } from "@stellar/stellar-sdk";

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";

/** The anchor's SEP-1 home domain. Every endpoint is discovered from it. */
export const ANCHOR_HOME_DOMAIN = "tr-mock-anchor.fly.dev";

/**
 * The asset the anchor ramps. Circle's testnet USDC issuer.
 * It is also read from the SEP-1 toml; this constant is only used when creating the trustline.
 */
export const USDC_CODE = "USDC";
export const USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

/** USDC's Stellar Asset Contract address — used by the Soroban contracts. */
export const USDC_SAC =
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

/** DeFindex — our own vault was created from this factory. */
export const DEFINDEX_FACTORY =
  "CDSCWE4GLNBYYTES2OCYDFQA2LLY4RBIAX6ZI32VSUXD7GO6HRPO4A32";
export const SOROSWAP_ROUTER =
  "CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD";

/**
 * Our contracts deployed to testnet — see deployments.json.
 * Verified end to end: create → join → progress → finalize → claim.
 */
export const RUNFORREST_CHALLENGE_ID =
  process.env.NEXT_PUBLIC_RUNFORREST_CHALLENGE_ID ??
  "CAN4QVZURUX6OLBFC7IH2HQHQDUJDD72UBGJLXR67BKACWBQF4JVUWCM";
export const RUNFORREST_BADGE_ID =
  process.env.NEXT_PUBLIC_RUNFORREST_BADGE_ID ??
  "CBEMQGDLL2KNMBSINUSQM7QXMKAOMFIJDFQL27F3ZEWSRYA75WB3VCU6";
/** RunForrest Prize Vault — the custody layer for the prize pool. */
export const RUNFORREST_VAULT_ID =
  process.env.NEXT_PUBLIC_RUNFORREST_VAULT_ID ??
  "CCHEMDA647SX2RPQ4FYQ3HLDXLVSREQSIAWXVQ2AYRMEHPQLVSGXASI7";

/** Anchor limits — verified from /health and /sep6/info. */
export const ANCHOR_LIMITS = {
  minOnrampTry: 50,
  maxOnrampTry: 3000,
  minUsdc: 0.5,
  maxUsdc: 300,
  feePercent: 0.5,
} as const;

/** Challenge entry fee. 10 USDC ≈ 500 TRY (within the anchor's limits). */
export const ENTRY_FEE_USDC = "10";

export const explorerTx = (hash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`;
export const explorerAccount = (pub: string) =>
  `https://stellar.expert/explorer/testnet/account/${pub}`;
export const explorerContract = (id: string) =>
  `https://stellar.expert/explorer/testnet/contract/${id}`;
