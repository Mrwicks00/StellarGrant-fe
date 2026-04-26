/**
 * Base error class for all StellarGrants SDK errors.
 */
export class StellarGrantsError extends Error {
  /** A unique error code identifying the type of error. */
  readonly code: string;
  /** Additional context or raw response data associated with the error. */
  readonly details?: unknown;

  /**
   * Creates a new StellarGrantsError.
   * @param message Human-readable error message.
   * @param code Unique error code (e.g., "TRANSACTION_FAILED").
   * @param details Optional additional data (e.g., RPC response).
   */
  constructor(message: string, code = "STELLAR_GRANTS_ERROR", details?: unknown) {
    super(message);
    this.name = "StellarGrantsError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Error thrown specifically when a Soroban contract invocation reverts.
 * This usually contains the error message emitted by the contract.
 */
export class SorobanRevertError extends StellarGrantsError {
  constructor(message: string, details?: unknown) {
    super(message, "SOROBAN_REVERT", details);
    this.name = "SorobanRevertError";
  }
}
