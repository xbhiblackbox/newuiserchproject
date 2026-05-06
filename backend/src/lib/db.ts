import { Pool, PoolClient } from "pg";
import * as fs from "fs";
import * as path from "path";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway")
    ? { rejectUnauthorized: false }
    : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err.message);
});

export { pool };

export async function query<T = any>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = any>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function execute(
  text: string,
  params?: unknown[]
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(text, params);
  } finally {
    client.release();
  }
}

// Run database migrations from /migrations/*.sql files
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name text PRIMARY KEY,
        ran_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const migrationsDir = path.join(__dirname, "../../migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        "SELECT name FROM _migrations WHERE name = $1",
        [file]
      );
      if (rows.length > 0) {
        console.log(`[migrate] Skipping ${file} (already ran)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`[migrate] Running ${file}...`);
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      console.log(`[migrate] ${file} done`);
    }
  } finally {
    client.release();
  }
}
