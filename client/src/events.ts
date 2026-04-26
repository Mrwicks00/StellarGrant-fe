import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";

/**
 * Represents a parsed contract event.
 */
export interface ParsedEvent<T = any> {
  /** The name of the event (e.g., "GrantCreated"). */
  name: string;
  /** The data associated with the event. */
  data: T;
  /** The ID of the contract that emitted the event. */
  contractId: string;
}

/**
 * Utility for parsing Soroban contract events.
 */
export class EventParser {
  /**
   * Extracts and decodes events from a successful transaction response.
   * @param response The transaction response from the RPC server.
   * @returns An array of parsed events.
   */
  static parseEvents(response: rpc.Api.GetTransactionResponse): ParsedEvent[] {
    if (response.status !== "SUCCESS" || !response.events) {
      return [];
    }

    return response.events.map((event) => {
      const parseScVal = (val: any): xdr.ScVal => {
        if (typeof val === "string") {
          return xdr.ScVal.fromXDR(val, "base64");
        }
        return val as xdr.ScVal;
      };

      const topics = event.topic.map((t) => scValToNative(parseScVal(t)));
      const value = scValToNative(parseScVal(event.value));

      // For Soroban contract events:
      // Topic 0 is usually the event name symbol.
      const name = topics.length > 0 ? String(topics[0]) : "unknown";

      return {
        name,
        data: value,
        contractId: event.contractId,
      };
    });
  }

  /**
   * Helper to find the first event by name.
   */
  static findEvent<T = any>(events: ParsedEvent[], name: string): ParsedEvent<T> | undefined {
    return events.find((e) => e.name === name);
  }

  /**
   * Helper to filter events by name.
   */
  static filterEvents<T = any>(events: ParsedEvent[], name: string): ParsedEvent<T>[] {
    return events.filter((e) => e.name === name);
  }
}

// Event Data Types based on events.rs

export interface GrantCreatedData {
  event_version: number;
  grant_id: bigint;
  owner: string;
  title: string;
  total_amount: bigint;
  tags: string[];
  timestamp: bigint;
}

export interface MilestoneSubmittedData {
  event_version: number;
  grant_id: bigint;
  milestone_idx: number;
  description: string;
  timestamp: bigint;
}

export interface GrantFundedData {
  event_version: number;
  grant_id: bigint;
  funder: string;
  amount: bigint;
  token: string;
  new_balance: bigint;
  timestamp: bigint;
}

export interface MilestoneVotedData {
  event_version: number;
  grant_id: bigint;
  milestone_idx: number;
  reviewer: string;
  approve: boolean;
  feedback?: string;
  timestamp: bigint;
}
