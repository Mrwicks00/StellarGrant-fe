export { getRpcClient, rpcClient, networkPassphraseConfig } from "./client";
export { ContractClient, contractClient } from "./contract";
export { fetchContractEvents, decodeEvent } from "./events";
export type { ContractEvent } from "./events";
export { BatchBuilder } from "./batchBuilder";
export type { BatchOperation, BatchResult } from "./batchBuilder";

// Multi-signature transaction support
export {
  buildUnsignedTransaction,
  combineSignatures,
  submitSignedXdr,
  isValidTransactionXdr,
  MultiSigTracker,
} from "./multisig";
export type {
  TransactionXdr,
  SignerStatus,
  SignerEntry,
  MultiSigStatus,
  BuildUnsignedTxOptions,
  SubmitOptions,
} from "./multisig";
