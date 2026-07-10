import type { Address } from "viem";
import { isAddress } from "viem";
import { env } from "./env.js";

const ZERO = "0x0000000000000000000000000000000000000000";

export interface NamedAddress {
  name: string;
  address: Address;
}

export interface DexFactoryConfig extends NamedAddress {
  type: "v2" | "v3";
}

export interface LaunchpadConfig extends NamedAddress {
  type: "bonding_curve" | "factory" | "locker" | "unknown";
  startBlock?: number;
}

const DEFAULT_LAUNCHPADS: LaunchpadConfig[] = [
  {
    name: "ArrowPad",
    address: "0x5d2391CF88cd48BB6B9Ec12b38BC8119562F9012",
    type: "bonding_curve",
    startBlock: 1_833_466,
  },
  {
    name: "Sentry",
    address: "0x9e8f6f8214b01Fd4Cf1d73FB1fb7cf9f811036Cb",
    type: "factory",
    startBlock: 1_431_636,
  },
  {
    name: "NOXA Fun",
    address: "0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB",
    type: "factory",
    startBlock: 61_688,
  },
];

function parseNamedList(value: string): NamedAddress[] {
  if (!value.trim()) return [];

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, address] = entry.split(":");
      if (!name || !address || !isAddress(address) || address === ZERO) return null;
      return { name, address: address as Address };
    })
    .filter((entry): entry is NamedAddress => Boolean(entry));
}

function parseDexFactories(): DexFactoryConfig[] {
  const fromList = env.dexFactories
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, address, type = "v2"] = entry.split(":");
      if (!name || !address || !isAddress(address) || address === ZERO) return null;
      if (type !== "v2" && type !== "v3") return null;
      return { name, address: address as Address, type };
    })
    .filter((entry): entry is DexFactoryConfig => Boolean(entry));

  if (fromList.length > 0) return fromList;

  if (env.dexFactoryAddress && isAddress(env.dexFactoryAddress) && env.dexFactoryAddress !== ZERO) {
    return [{ name: "RobinhoodSwap", address: env.dexFactoryAddress as Address, type: "v2" }];
  }

  return [];
}

function parseDexRouters(): NamedAddress[] {
  const fromList = parseNamedList(env.dexRouters);
  if (fromList.length > 0) return fromList;

  if (env.dexRouterAddress && isAddress(env.dexRouterAddress) && env.dexRouterAddress !== ZERO) {
    return [{ name: "PrimaryRouter", address: env.dexRouterAddress as Address }];
  }

  return [];
}

function parseLaunchpads(): LaunchpadConfig[] {
  const configured = env.launchpadContracts
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<LaunchpadConfig[]>((acc, entry) => {
      const [name, address, type = "unknown", startBlock] = entry.split(":");
      if (!name || !address || !isAddress(address) || address === ZERO) return acc;
      const safeType = ["bonding_curve", "factory", "locker", "unknown"].includes(type)
        ? (type as LaunchpadConfig["type"])
        : "unknown";
      const parsedStartBlock = startBlock ? Number(startBlock) : undefined;
      const launchpad: LaunchpadConfig = {
        name,
        address: address as Address,
        type: safeType,
      };

      if (Number.isFinite(parsedStartBlock)) {
        launchpad.startBlock = parsedStartBlock;
      }

      acc.push(launchpad);
      return acc;
    }, []);

  return mergeLaunchpads(configured, DEFAULT_LAUNCHPADS);
}

function mergeLaunchpads(configured: LaunchpadConfig[], defaults: LaunchpadConfig[]): LaunchpadConfig[] {
  const seen = new Set(configured.map((entry) => entry.address.toLowerCase()));
  const missingDefaults = defaults.filter((entry) => !seen.has(entry.address.toLowerCase()));
  return [...configured, ...missingDefaults];
}

export const contractConfig = {
  zeroAddress: ZERO,
  dexRouters: parseDexRouters(),
  dexFactories: parseDexFactories(),
  lpLockers: parseNamedList(env.lpLockerAddresses),
  launchpads: parseLaunchpads(),
  quoteTokens: [
    ...(env.wethAddress && isAddress(env.wethAddress) && env.wethAddress !== ZERO
      ? [env.wethAddress as Address]
      : []),
  ],
} as const;
