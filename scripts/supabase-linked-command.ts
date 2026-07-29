import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runSupabaseLinkedCommand } from "./supabase-linked-command-core";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

process.exitCode = runSupabaseLinkedCommand({
  argv: process.argv.slice(2),
  env: process.env,
  repoRoot,
});
