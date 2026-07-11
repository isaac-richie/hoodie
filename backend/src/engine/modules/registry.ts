/**
 * Module Registry — registers all scan modules and makes them available to the scanner.
 *
 * To add a new module:
 *   1. Create a file in this directory implementing the ScanModule interface
 *   2. Import and register it below
 *   3. The scanner will automatically pick it up and run it in parallel
 *
 * Module weights (higher = more influence on final score):
 *   15 — honeypot_sim      (can you sell? highest priority)
 *   14 — deployer_reputation (serial rugger detection)
 *   13 — bundle_detect      (coordinated launch buys)
 *   12 — holder_distribution, lp_lock
 *   11 — hidden_mint
 *   10 — proxy_check, scam_template
 *    9 — mutable_tax
 *    8 — ownership, sniper_detect
 *    7 — blacklist
 *    6 — trading_pause, fresh_wallets
 *    5 — source_verification
 */
import type { ScanModule } from "../types.js";
import { honeypotModule } from "./honeypot.js";
import { lpLockModule } from "./lp-lock.js";
import { ownershipModule } from "./ownership.js";
import { holderDistModule } from "./holder-dist.js";
import { bundleDetectModule } from "./bundle-detect.js";
import { deployerRepModule } from "./deployer-rep.js";
import { hiddenMintModule } from "./hidden-mint.js";
import { mutableTaxModule } from "./mutable-tax.js";
import { proxyCheckModule } from "./proxy-check.js";
import { blacklistModule } from "./blacklist.js";
import { tradingPauseModule } from "./trading-pause.js";
import { sniperDetectModule } from "./sniper-detect.js";
import { freshWalletModule } from "./fresh-wallets.js";
import { scamTemplateModule } from "./scam-template.js";
import { sourceVerificationModule } from "./source-verification.js";

class ModuleRegistry {
  private modules: ScanModule[] = [];

  register(mod: ScanModule) {
    this.modules.push(mod);
  }

  getAll(): ScanModule[] {
    return this.modules;
  }

  getByCategory(category: string): ScanModule[] {
    return this.modules.filter((m) => m.category === category);
  }

  count(): number {
    return this.modules.length;
  }
}

export const registry = new ModuleRegistry();

// Register all modules
registry.register(honeypotModule);
registry.register(lpLockModule);
registry.register(ownershipModule);
registry.register(holderDistModule);
registry.register(bundleDetectModule);
registry.register(deployerRepModule);
registry.register(hiddenMintModule);
registry.register(mutableTaxModule);
registry.register(proxyCheckModule);
registry.register(blacklistModule);
registry.register(tradingPauseModule);
registry.register(sniperDetectModule);
registry.register(freshWalletModule);
registry.register(scamTemplateModule);
registry.register(sourceVerificationModule);
