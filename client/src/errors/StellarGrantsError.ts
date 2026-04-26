export class StellarGrantsError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, code = "STELLAR_GRANTS_ERROR", details?: unknown) {
    super(message);
    this.name = "StellarGrantsError";
    this.code = code;
    this.details = details;
  }
}

export class SorobanRevertError extends StellarGrantsError {
  constructor(message: string, details?: unknown) {
    super(message, "SOROBAN_REVERT", details);
    this.name = "SorobanRevertError";
  }
}

export class UnauthorizedError extends SorobanRevertError {
  constructor(details?: unknown) {
    super("Unauthorized: You do not have permission to perform this action.", details);
    this.name = "UnauthorizedError";
  }
}

export class GrantNotFoundError extends SorobanRevertError {
  constructor(details?: unknown) {
    super("Grant not found: The requested grant does not exist or has been removed.", details);
    this.name = "GrantNotFoundError";
  }
}

export class InvalidStateError extends SorobanRevertError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = "InvalidStateError";
  }
}
