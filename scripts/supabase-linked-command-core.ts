import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import process from "node:process";

export const PRODUCTION_PROJECT_REF = "semaarjjdmbjwzgvbenu";
export const STAGING_PROJECT_REF = "gwwcooupkmhihaigympb";

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/u;
const CONFIRMATION_PREFIX = "--confirm-project-ref=";

export type GuardedRecipe = "migration-list" | "db-push-dry-run";
export type ParsedCommand =
  | {
      recipe: "status";
      confirmProjectRef: null;
    }
  | {
      recipe: GuardedRecipe;
      confirmProjectRef: string;
    };

export type GuardEnvironment = Partial<
  Record<
    | "HOSTED_STAGING_PROJECT_REF"
    | "SUPABASE_URL"
    | "SUPABASE_CLI_BINARY_OVERRIDE"
    | "VITE_SUPABASE_PROJECT_ID"
    | "VITE_SUPABASE_URL",
    string | undefined
  >
>;

export type CliInvocation = {
  command: string;
  prefixArgs: string[];
};

export type CommandExecutorOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  shell: false;
  stdio: "inherit";
};

export type CommandExecutorResult = {
  error?: unknown;
  signal?: NodeJS.Signals | null;
  status: number | null;
};

export type CommandExecutor = (
  command: string,
  args: readonly string[],
  options: CommandExecutorOptions,
) => CommandExecutorResult;

export class SupabaseLinkedGuardError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "SupabaseLinkedGuardError";
  }
}

function fail(code: string): never {
  throw new SupabaseLinkedGuardError(code);
}

function requiredTrimmed(value: string | undefined, errorCode: string): string {
  const trimmed = value?.trim();
  if (!trimmed) fail(errorCode);
  return trimmed;
}

function assertValidProjectRef(projectRef: string, errorCode: string): void {
  if (!PROJECT_REF_PATTERN.test(projectRef)) fail(errorCode);
}

function projectRefFromSupabaseUrl(value: string | undefined, variableName: string): string {
  const rawUrl = requiredTrimmed(value, `${variableName.toLowerCase()}_missing`);
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return fail(`${variableName.toLowerCase()}_invalid`);
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    (parsed.pathname !== "/" && parsed.pathname !== "") ||
    parsed.search ||
    parsed.hash
  ) {
    fail(`${variableName.toLowerCase()}_invalid`);
  }

  const suffix = ".supabase.co";
  if (!parsed.hostname.endsWith(suffix)) fail(`${variableName.toLowerCase()}_invalid`);

  const projectRef = parsed.hostname.slice(0, -suffix.length);
  assertValidProjectRef(projectRef, `${variableName.toLowerCase()}_invalid`);
  return projectRef;
}

export function parseCommandArguments(argv: readonly string[]): ParsedCommand {
  const [rawRecipe, ...extraArgs] = argv;

  if (rawRecipe === "status") {
    if (extraArgs.length !== 0) fail("unexpected_arguments");
    return {
      recipe: "status",
      confirmProjectRef: null,
    };
  }

  if (rawRecipe !== "migration-list" && rawRecipe !== "db-push-dry-run") {
    fail("unknown_recipe");
  }

  if (extraArgs.length !== 1 || !extraArgs[0]?.startsWith(CONFIRMATION_PREFIX)) {
    fail("manual_confirmation_required");
  }

  const confirmProjectRef = extraArgs[0].slice(CONFIRMATION_PREFIX.length);
  assertValidProjectRef(confirmProjectRef, "manual_confirmation_invalid");

  return {
    recipe: rawRecipe,
    confirmProjectRef,
  };
}

export function readLinkedProjectRef(repoRoot: string): string {
  const projectRefPath = join(repoRoot, "supabase", ".temp", "project-ref");
  let projectRef: string;
  try {
    projectRef = readFileSync(projectRefPath, "utf8").trim();
  } catch {
    return fail("linked_project_ref_missing");
  }

  assertValidProjectRef(projectRef, "linked_project_ref_invalid");
  return projectRef;
}

export function classifyLinkedProject(
  linkedProjectRef: string,
): "production" | "staging" | "unknown" {
  assertValidProjectRef(linkedProjectRef, "linked_project_ref_invalid");
  if (linkedProjectRef === PRODUCTION_PROJECT_REF) return "production";
  if (linkedProjectRef === STAGING_PROJECT_REF) return "staging";
  return "unknown";
}

export function guardedRecipeArgs(input: {
  confirmProjectRef: string;
  env: GuardEnvironment;
  linkedProjectRef: string;
  recipe: GuardedRecipe;
}): string[] {
  const { confirmProjectRef, env, linkedProjectRef, recipe } = input;
  const classification = classifyLinkedProject(linkedProjectRef);

  if (classification === "production") fail("production_link_hard_blocked");
  if (classification !== "staging") fail("unapproved_linked_project");
  if (env.SUPABASE_CLI_BINARY_OVERRIDE?.trim()) {
    fail("supabase_cli_binary_override_forbidden");
  }

  const hostedStagingProjectRef = requiredTrimmed(
    env.HOSTED_STAGING_PROJECT_REF,
    "hosted_staging_project_ref_missing",
  );
  assertValidProjectRef(hostedStagingProjectRef, "hosted_staging_project_ref_invalid");

  const supabaseUrlProjectRef = projectRefFromSupabaseUrl(env.SUPABASE_URL, "SUPABASE_URL");
  const viteSupabaseUrlProjectRef = projectRefFromSupabaseUrl(
    env.VITE_SUPABASE_URL,
    "VITE_SUPABASE_URL",
  );
  const viteSupabaseProjectRef = requiredTrimmed(
    env.VITE_SUPABASE_PROJECT_ID,
    "vite_supabase_project_id_missing",
  );
  assertValidProjectRef(viteSupabaseProjectRef, "vite_supabase_project_id_invalid");

  const agreedRefs = [
    hostedStagingProjectRef,
    supabaseUrlProjectRef,
    viteSupabaseUrlProjectRef,
    viteSupabaseProjectRef,
    confirmProjectRef,
  ];
  if (agreedRefs.some((projectRef) => projectRef !== STAGING_PROJECT_REF)) {
    fail("staging_project_confirmation_mismatch");
  }

  switch (recipe) {
    case "migration-list":
      return ["migration", "list", "--linked"];
    case "db-push-dry-run":
      return ["db", "push", "--linked", "--include-all", "--dry-run"];
  }
}

function isRegularFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

export function resolveSupabaseCliInvocation(
  repoRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): CliInvocation {
  const pathValue = env.PATH ?? env.Path ?? "";
  const pathDirectories = pathValue
    .split(delimiter)
    .map((entry) => entry.trim().replace(/^"(.*)"$/u, "$1"))
    .filter(Boolean);

  const javascriptEntrypointCandidates = [
    join(repoRoot, "node_modules", "supabase", "dist", "supabase.js"),
    ...pathDirectories.flatMap((pathDirectory) => [
      join(pathDirectory, "node_modules", "supabase", "dist", "supabase.js"),
      resolve(pathDirectory, "..", "supabase", "dist", "supabase.js"),
    ]),
  ];

  const javascriptEntrypoint = javascriptEntrypointCandidates.find(isRegularFile);
  if (javascriptEntrypoint) {
    return {
      command: process.execPath,
      prefixArgs: [javascriptEntrypoint],
    };
  }

  if (process.platform !== "win32") {
    return {
      command: "supabase",
      prefixArgs: [],
    };
  }

  const nativeExecutable = pathDirectories
    .map((pathDirectory) => join(pathDirectory, "supabase.exe"))
    .find(isRegularFile);
  if (nativeExecutable) {
    return {
      command: nativeExecutable,
      prefixArgs: [],
    };
  }

  return fail("supabase_cli_not_found");
}

const defaultExecutor: CommandExecutor = (command, args, options) =>
  spawnSync(command, [...args], options);

const SUPABASE_CLI_ENV_ALLOWLIST = new Set([
  "ALLUSERSPROFILE",
  "ALL_PROXY",
  "APPDATA",
  "CI",
  "CommonProgramFiles",
  "CommonProgramFiles(x86)",
  "CommonProgramW6432",
  "ComSpec",
  "DO_NOT_TRACK",
  "FORCE_COLOR",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "LOCALAPPDATA",
  "NODE_EXTRA_CA_CERTS",
  "NO_COLOR",
  "NO_PROXY",
  "OS",
  "PATH",
  "PATHEXT",
  "Path",
  "ProgramData",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "ProgramW6432",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_HOME",
  "SUPABASE_NO_KEYRING",
  "SUPABASE_PROFILE",
  "SUPABASE_TELEMETRY_DISABLED",
  "SystemDrive",
  "SystemRoot",
  "TEMP",
  "TERM",
  "TMP",
  "USERDOMAIN",
  "USERNAME",
  "USERPROFILE",
  "WINDIR",
  "all_proxy",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "windir",
]);

export function sanitizeSupabaseCliEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter(
      ([name, value]) => value !== undefined && SUPABASE_CLI_ENV_ALLOWLIST.has(name),
    ),
  );
}

export function executeFixedRecipe(
  input: {
    cliInvocation: CliInvocation;
    cwd: string;
    env: NodeJS.ProcessEnv;
    recipeArgs: readonly string[];
  },
  executor: CommandExecutor = defaultExecutor,
): number {
  const result = executor(
    input.cliInvocation.command,
    [...input.cliInvocation.prefixArgs, ...input.recipeArgs],
    {
      cwd: input.cwd,
      env: sanitizeSupabaseCliEnvironment(input.env),
      shell: false,
      stdio: "inherit",
    },
  );

  if (result.error) fail("supabase_cli_launch_failed");
  if (result.signal) fail("supabase_cli_terminated");
  if (result.status === null) fail("supabase_cli_status_missing");
  return result.status;
}

export type GuardCommandDependencies = {
  error: (message: string) => void;
  executor: CommandExecutor;
  log: (message: string) => void;
  readLinkedProjectRef: (repoRoot: string) => string;
  resolveCliInvocation: (repoRoot: string, env: NodeJS.ProcessEnv) => CliInvocation;
};

const defaultDependencies: GuardCommandDependencies = {
  error: (message) => console.error(message),
  executor: defaultExecutor,
  log: (message) => console.log(message),
  readLinkedProjectRef,
  resolveCliInvocation: resolveSupabaseCliInvocation,
};

export function runSupabaseLinkedCommand(
  input: {
    argv: readonly string[];
    env: NodeJS.ProcessEnv;
    repoRoot: string;
  },
  dependencyOverrides: Partial<GuardCommandDependencies> = {},
): number {
  const dependencies = {
    ...defaultDependencies,
    ...dependencyOverrides,
  };

  try {
    const command = parseCommandArguments(input.argv);
    const linkedProjectRef = dependencies.readLinkedProjectRef(input.repoRoot);
    const classification = classifyLinkedProject(linkedProjectRef);

    if (command.recipe === "status") {
      const eligibility =
        classification === "staging"
          ? "eligible only after staging confirmations"
          : "all guarded commands blocked";
      dependencies.log(`Supabase linked environment: ${classification}; ${eligibility}.`);
      return 0;
    }

    // Complete every project/environment/confirmation check before looking up
    // or launching a Supabase executable. Production and unknown links must
    // have no command-side effects at all.
    const recipeArgs = guardedRecipeArgs({
      confirmProjectRef: command.confirmProjectRef,
      env: input.env,
      linkedProjectRef,
      recipe: command.recipe,
    });
    const cliInvocation = dependencies.resolveCliInvocation(input.repoRoot, input.env);

    return executeFixedRecipe(
      {
        cliInvocation,
        cwd: input.repoRoot,
        env: input.env,
        recipeArgs,
      },
      dependencies.executor,
    );
  } catch (error) {
    const code =
      error instanceof SupabaseLinkedGuardError ? error.code : "unexpected_guard_failure";
    dependencies.error(`Supabase linked command refused: ${code}.`);
    return 2;
  }
}
