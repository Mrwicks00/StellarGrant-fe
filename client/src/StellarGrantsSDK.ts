import {
  Contract,
  rpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { parseSorobanError } from "./errors/parseSorobanError";
import { StellarGrantsError } from "./errors/StellarGrantsError";
import {
  GrantCreateInput,
  GrantFundInput,
  MilestoneSubmitInput,
  MilestoneVoteInput,
  StellarGrantsSDKConfig,
} from "./types";
import { EventParser, ParsedEvent } from "./events";

/**
 * Encapsulated client for StellarGrants Soroban contract interactions.
 * 
 * This SDK provides a high-level interface to interact with the StellarGrants smart contract.
 * It handles transaction building, simulation, signing (via a provided signer), and submission.
 * 
 * @example
 * ```typescript
 * const sdk = new StellarGrantsSDK({
 *   contractId: "CD...",
 *   rpcUrl: "https://soroban-testnet.stellar.org",
 *   networkPassphrase: "Test SDF Network ; September 2015",
 *   signer: freighterSigner
 * });
 * ```
 */
export class StellarGrantsSDK {
  private readonly contract: Contract;
  private readonly server: rpc.Server;
  private readonly config: StellarGrantsSDKConfig;

  /**
   * Initializes a new instance of the StellarGrantsSDK.
   * @param config Configuration options including contract ID, RPC URL, and signer.
   */
  constructor(config: StellarGrantsSDKConfig) {
    this.config = config;
    this.contract = new Contract(config.contractId);
    this.server = new rpc.Server(config.rpcUrl, {
      allowHttp: config.rpcUrl.startsWith("http://"),
    });
  }

  /**
   * Creates a new grant in the system.
   * 
   * @param input Details of the grant to create.
   * @returns A promise that resolves to the transaction submission result.
   * @throws {StellarGrantsError} If simulation fails or transaction submission is rejected.
   * @throws {SorobanRevertError} If the contract call reverts.
   * 
   * @example
   * ```typescript
   * const result = await sdk.grantCreate({
   *   owner: "G...",
   *   title: "Open Source SDK",
   *   description: "Building a better SDK for Stellar",
   *   budget: 5000000000n, // 500 XLM
   *   deadline: 1735689600n,
   *   milestoneCount: 3
   * });
   * ```
   */
  async grantCreate(input: GrantCreateInput): Promise<rpc.Api.SendTransactionResponse> {
    return this.invokeWrite("grant_create", [
      nativeToScVal(input.owner, { type: "address" }),
      nativeToScVal(input.title),
      nativeToScVal(input.description),
      nativeToScVal(input.budget, { type: "i128" }),
      nativeToScVal(input.deadline, { type: "u64" }),
      nativeToScVal(input.milestoneCount, { type: "u32" }),
    ]) as Promise<rpc.Api.SendTransactionResponse>;
  }

  /**
   * Funds an existing grant with tokens.
   * 
   * @param input Funding details including grant ID, token address, and amount.
   * @returns A promise that resolves to the transaction submission result.
   * @throws {StellarGrantsError} If simulation fails or transaction submission is rejected.
   */
  async grantFund(input: GrantFundInput): Promise<rpc.Api.SendTransactionResponse> {
    return this.invokeWrite("grant_fund", [
      nativeToScVal(input.grantId, { type: "u32" }),
      nativeToScVal(input.token, { type: "address" }),
      nativeToScVal(input.amount, { type: "i128" }),
    ]) as Promise<rpc.Api.SendTransactionResponse>;
  }

  /**
   * Submits a proof hash for a specific milestone.
   * 
   * @param input Milestone details and the proof hash.
   * @returns A promise that resolves to the transaction submission result.
   * @throws {StellarGrantsError} If the milestone index is invalid or caller is not the owner.
   */
  async milestoneSubmit(input: MilestoneSubmitInput): Promise<rpc.Api.SendTransactionResponse> {
    return this.invokeWrite("milestone_submit", [
      nativeToScVal(input.grantId, { type: "u32" }),
      nativeToScVal(input.milestoneIdx, { type: "u32" }),
      nativeToScVal(input.proofHash),
    ]) as Promise<rpc.Api.SendTransactionResponse>;
  }

  /**
   * Casts a vote (approval or rejection) for a milestone.
   * 
   * @param input Vote details including grant ID, milestone index, and approval flag.
   * @returns A promise that resolves to the transaction submission result.
   * @throws {StellarGrantsError} If the caller is not an authorized reviewer.
   */
  async milestoneVote(input: MilestoneVoteInput): Promise<rpc.Api.SendTransactionResponse> {
    return this.invokeWrite("milestone_vote", [
      nativeToScVal(input.grantId, { type: "u32" }),
      nativeToScVal(input.milestoneIdx, { type: "u32" }),
      nativeToScVal(input.approve),
    ]) as Promise<rpc.Api.SendTransactionResponse>;
  }

  /**
   * Retrieves the details of a grant from the contract (read-only).
   * 
   * @param grantId The unique numeric ID of the grant.
   * @returns A promise that resolves to the grant data.
   */
  async grantGet(grantId: number): Promise<unknown> {
    return this.invokeRead("grant_get", [nativeToScVal(grantId, { type: "u32" })]);
  }

  /**
   * Retrieves milestone details for a specific grant (read-only).
   * 
   * @param grantId The unique numeric ID of the grant.
   * @param milestoneIdx The 0-based index of the milestone.
   * @returns A promise that resolves to the milestone data.
   */
  async milestoneGet(grantId: number, milestoneIdx: number): Promise<unknown> {
    return this.invokeRead("milestone_get", [
      nativeToScVal(grantId, { type: "u32" }),
      nativeToScVal(milestoneIdx, { type: "u32" }),
    ]);
  }

  /**
   * Polls the RPC server for the status of a transaction until it reaches a terminal state.
   * 
   * This utility is essential for waiting until a transaction is actually included in a ledger.
   * 
   * @param hash The transaction hash to wait for.
   * @param intervalMs The polling interval in milliseconds. Defaults to config or 1000ms.
   * @param timeoutMs The total timeout in milliseconds. Defaults to config or 30000ms.
   * @returns The full transaction response from the RPC server once successful.
   * @throws {StellarGrantsError} If the transaction fails or times out.
   * 
   * @example
   * ```typescript
   * const sent = await sdk.grantCreate(input);
   * const confirmed = await sdk.waitForTransaction(sent.hash);
   * console.log("Ledger:", confirmed.ledger);
   * ```
   */
  async waitForTransaction(
    hash: string,
    intervalMs: number = this.config.pollingIntervalMs ?? 1000,
    timeoutMs: number = this.config.pollingTimeoutMs ?? 30000,
  ): Promise<rpc.Api.GetTransactionResponse> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const response = await this.server.getTransaction(hash);
      if (response.status !== "NOT_FOUND") {
        if (response.status === "SUCCESS") {
          return response;
        }
        if (response.status === "FAILED") {
          throw new StellarGrantsError(`Transaction failed: ${hash}`, "TRANSACTION_FAILED", response);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new StellarGrantsError(`Transaction timed out: ${hash}`, "TRANSACTION_TIMEOUT");
  }

  /**
   * Extracts and parses contract events from a successful transaction response.
   * 
   * @param response The successful transaction response obtained from `waitForTransaction`.
   * @returns An array of parsed events with native JavaScript types.
   * 
   * @example
   * ```typescript
   * const events = sdk.parseEvents(confirmedTx);
   * const created = EventParser.findEvent<GrantCreatedData>(events, "GrantCreated");
   * ```
   */
  parseEvents(response: rpc.Api.GetTransactionResponse): ParsedEvent[] {
    return EventParser.parseEvents(response);
  }

  /**
   * Internal helper for read-only contract invocations.
   */
  private async invokeRead(method: string, args: xdr.ScVal[]): Promise<unknown> {
    try {
      const tx = await this.buildTx(method, args);
      const simulation = await this.server.simulateTransaction(tx);
      this.ensureSimulationSuccess(simulation);
      return this.parseSimulationResult(simulation);
    } catch (error) {
      throw parseSorobanError(error);
    }
  }

  /**
   * Internal helper for state-changing contract invocations.
   */
  private async invokeWrite(method: string, args: xdr.ScVal[]): Promise<unknown> {
    try {
      const tx = await this.buildTx(method, args);
      const simulation = await this.server.simulateTransaction(tx);
      this.ensureSimulationSuccess(simulation);

      const prepared = await this.server.prepareTransaction(tx);
      const signedXdr = await this.config.signer.signTransaction(
        prepared.toXDR(),
        this.config.networkPassphrase,
      );
      const signedTx = TransactionBuilder.fromXDR(signedXdr, this.config.networkPassphrase);

      const sent = await this.server.sendTransaction(signedTx);
      if (sent.status === "ERROR") {
        throw new StellarGrantsError(`Send failed: ${sent.errorResult ?? "unknown error"}`);
      }
      return sent;
    } catch (error) {
      throw parseSorobanError(error);
    }
  }

  /**
   * Builds a transaction for a contract call.
   */
  private async buildTx(method: string, args: xdr.ScVal[]) {
    const source = await this.config.signer.getPublicKey();
    const account = await this.server.getAccount(source);
    return new TransactionBuilder(account, {
      fee: this.config.defaultFee ?? "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(60)
      .build();
  }

  /**
   * Validates that the simulation was successful.
   */
  private ensureSimulationSuccess(simulation: any) {
    if (simulation?.error) {
      throw new StellarGrantsError(String(simulation.error));
    }
  }

  /**
   * Parses the return value from a simulation result.
   */
  private parseSimulationResult(simulation: any): unknown {
    const retval = simulation?.result?.retval;
    if (!retval) return null;
    return scValToNative(retval);
  }
}
