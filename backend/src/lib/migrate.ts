import { runMigrations } from "./db";

runMigrations()
  .then(() => {
    console.log("[migrate] All migrations complete.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("[migrate] Failed:", e);
    process.exit(1);
  });
