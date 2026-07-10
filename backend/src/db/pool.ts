import pg from "pg";

export interface DatabasePoolOptions {
  connectionString: string;
  max?: number;
  rejectUnauthorized?: boolean;
}

export function createDatabasePool(options: DatabasePoolOptions): pg.Pool {
  const ssl = resolveSslOptions(options.connectionString, options.rejectUnauthorized);

  return new pg.Pool({
    connectionString: options.connectionString,
    max: options.max,
    ...(ssl ? { ssl } : {}),
  });
}

function resolveSslOptions(
  connectionString: string,
  rejectUnauthorized?: boolean
): false | { rejectUnauthorized: boolean } {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return false;
  }

  const sslMode = url.searchParams.get("sslmode");
  if (sslMode === "disable") return false;

  const usesManagedPostgres =
    url.hostname.includes("supabase.com") ||
    url.hostname.includes("neon.tech") ||
    url.hostname.includes("render.com") ||
    url.searchParams.has("sslmode");

  if (!usesManagedPostgres) return false;

  return {
    rejectUnauthorized: rejectUnauthorized ?? sslMode !== "no-verify",
  };
}
