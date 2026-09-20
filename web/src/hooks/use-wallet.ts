"use client";

/**
 * Backwards compatibility: redirects the old wagmi-based `useWallet` imports
 * to the Stellar wallet context.
 */
export { useWallet, truncate } from "@/components/wallet/wallet-provider";
