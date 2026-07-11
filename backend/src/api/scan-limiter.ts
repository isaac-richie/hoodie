/**
 * API Scan Concurrency Limiter.
 *
 * The HTTP scan endpoints run `scanToken` inline on the request. Each scan is
 * RPC-heavy, so without a cap a burst of requests (or one abusive client) can
 * fan out to hundreds of concurrent scans, exhaust the RPC/DB pool, and stall
 * the whole API. This bounds how many scans run at once; requests over the cap
 * queue briefly rather than piling on unbounded work.
 */
import { env } from "../config/env.js";

let active = 0;
const queue: (() => void)[] = [];
const MAX_CONCURRENT = env.apiScanConcurrency;
// Hard ceiling on how many callers may wait for a slot; beyond this we shed load
// with a clear error instead of growing an unbounded queue (itself a DoS vector).
const MAX_QUEUE = MAX_CONCURRENT * 20;

export class ScanOverloadedError extends Error {
  constructor() {
    super("scan queue is saturated");
    this.name = "ScanOverloadedError";
  }
}

export async function withScanSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT && queue.length >= MAX_QUEUE) {
    throw new ScanOverloadedError();
  }

  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }

  active++;
  try {
    return await fn();
  } finally {
    active--;
    const next = queue.shift();
    if (next) next();
  }
}
