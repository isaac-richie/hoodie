/**
 * Scam Template Matching (weight: 10) — does the bytecode match known scam contracts?
 *
 * Compares the token's bytecode against a database of confirmed scam templates
 * using n-gram similarity (Jaccard index on 8-byte sliding windows).
 *
 * Many scam tokens are deployed from the same Solidity source with minor
 * modifications. Even with different variable names, the compiled bytecode
 * shares >80% similarity. This catches "copy-paste scams" that other modules miss.
 *
 * The SCAM_TEMPLATES array starts empty — populate it by adding bytecode patterns
 * from confirmed rugs. Each entry needs: id, pattern (hex), human-readable name.
 *
 * Score: 0 = no match, 50 = 60-80% similar, 80 = >80% similar.
 */
import { cachedRpc } from "../../services/rpc-cache.js";
import type { ScanModule, ScanContext, ModuleResult } from "../types.js";
import { friendlyError } from "../../utils/friendly-error.js";

const SCAM_TEMPLATES: { id: string; pattern: string; name: string }[] = [
  // Populate from confirmed rugs: { id: "honeypot-v1", pattern: "6080604052...", name: "Classic Honeypot" }
];

export const scamTemplateModule: ScanModule = {
  name: "scam_template",
  weight: 10,
  category: "meta",

  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();

    try {
      const bytecode = await cachedRpc.getCode(ctx.tokenAddress);

      if (!bytecode || bytecode.length < 100) {
        return {
          module: "scam_template",
          status: "warn",
          score: 20,
          weight: 10,
          label: "bytecode too short or missing",
          detail: "Cannot run template matching.",
          evidence: {},
          durationMs: Date.now() - start,
        };
      }

      if (SCAM_TEMPLATES.length === 0) {
        return {
          module: "scam_template",
          status: "warn",
          score: 5,
          weight: 10,
          label: "scam template database not seeded",
          detail: "No known scam bytecode templates are configured yet, so this check cannot prove template safety. Behavioral modules still ran.",
          evidence: { templatesChecked: 0, databaseSeeded: false },
          durationMs: Date.now() - start,
        };
      }

      const match = findTemplateMatch(bytecode);

      if (match) {
        return {
          module: "scam_template",
          status: "fail",
          score: match.similarity > 80 ? 80 : 50,
          weight: 10,
          label: `${match.similarity}% similar to template ${match.id}`,
          detail: `Bytecode matches known scam template "${match.name}" at ${match.similarity}% similarity.`,
          evidence: match,
          durationMs: Date.now() - start,
        };
      }

      return {
        module: "scam_template",
        status: "pass",
        score: 0,
        weight: 10,
        label: "no known scam template match",
        detail: "Bytecode does not match any known scam template in the database.",
        evidence: { templatesChecked: SCAM_TEMPLATES.length, databaseSeeded: true },
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        module: "scam_template",
        status: "error",
        score: 10,
        weight: 10,
        label: "scam-pattern check unavailable",
        detail: friendlyError(err, "scam-pattern"),
        evidence: {},
        durationMs: Date.now() - start,
      };
    }
  },
};

interface TemplateMatch {
  id: string;
  name: string;
  similarity: number;
}

function findTemplateMatch(bytecode: string): TemplateMatch | null {
  // Bytecode similarity scoring
  // Uses a sliding window comparison against known templates
  for (const template of SCAM_TEMPLATES) {
    const similarity = computeSimilarity(bytecode, template.pattern);
    if (similarity > 60) {
      return { id: template.id, name: template.name, similarity };
    }
  }
  return null;
}

function computeSimilarity(bytecodeA: string, patternB: string): number {
  // Simple n-gram similarity for bytecode comparison
  const windowSize = 8;
  const gramsA = new Set<string>();
  const gramsB = new Set<string>();

  for (let i = 0; i < bytecodeA.length - windowSize; i += 2) {
    gramsA.add(bytecodeA.slice(i, i + windowSize));
  }
  for (let i = 0; i < patternB.length - windowSize; i += 2) {
    gramsB.add(patternB.slice(i, i + windowSize));
  }

  let intersection = 0;
  for (const g of gramsA) {
    if (gramsB.has(g)) intersection++;
  }

  const union = gramsA.size + gramsB.size - intersection;
  return union > 0 ? Math.round((intersection / union) * 100) : 0;
}
