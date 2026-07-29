import { describe, expect, it, vi } from "vitest";

import {
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
  SupabaseLinkedGuardError,
  executeFixedRecipe,
  guardedRecipeArgs,
  parseCommandArguments,
  runSupabaseLinkedCommand,
  sanitizeSupabaseCliEnvironment,
  type CliInvocation,
  type CommandExecutor,
  type GuardEnvironment,
  type GuardedRecipe,
} from "../../../scripts/supabase-linked-command-core";

const STAGING_URL = `https://${STAGING_PROJECT_REF}.supabase.co`;
const CONFIRMATION = `--confirm-project-ref=${STAGING_PROJECT_REF}`;

const stagingEnvironment = (): NodeJS.ProcessEnv & GuardEnvironment => ({
  HOSTED_STAGING_PROJECT_REF: STAGING_PROJECT_REF,
  SUPABASE_URL: STAGING_URL,
  VITE_SUPABASE_PROJECT_ID: STAGING_PROJECT_REF,
  VITE_SUPABASE_URL: `${STAGING_URL}/`,
});

function expectGuardError(run: () => unknown, code: string): void {
  try {
    run();
    throw new Error("expected guard error");
  } catch (error) {
    expect(error).toBeInstanceOf(SupabaseLinkedGuardError);
    expect((error as SupabaseLinkedGuardError).code).toBe(code);
    expect((error as Error).message).toBe(code);
  }
}

function recipeInput(
  overrides: Partial<{
    confirmProjectRef: string;
    env: GuardEnvironment;
    linkedProjectRef: string;
    recipe: GuardedRecipe;
  }> = {},
) {
  return {
    confirmProjectRef: STAGING_PROJECT_REF,
    env: stagingEnvironment(),
    linkedProjectRef: STAGING_PROJECT_REF,
    recipe: "db-push-dry-run" as GuardedRecipe,
    ...overrides,
  };
}

describe("parseCommandArguments", () => {
  it("accepts status without a confirmation", () => {
    expect(parseCommandArguments(["status"])).toEqual({
      recipe: "status",
      confirmProjectRef: null,
    });
  });

  it("requires one exact manual project-ref confirmation", () => {
    expect(parseCommandArguments(["db-push-dry-run", CONFIRMATION])).toEqual({
      recipe: "db-push-dry-run",
      confirmProjectRef: STAGING_PROJECT_REF,
    });

    expectGuardError(
      () => parseCommandArguments(["db-push-dry-run"]),
      "manual_confirmation_required",
    );
    expectGuardError(
      () =>
        parseCommandArguments(["db-push-dry-run", "--confirm-project-ref", STAGING_PROJECT_REF]),
      "manual_confirmation_required",
    );
  });

  it("rejects retired mutating recipes and arbitrary forwarding", () => {
    expectGuardError(() => parseCommandArguments(["db-reset", CONFIRMATION]), "unknown_recipe");
    expectGuardError(
      () => parseCommandArguments(["migration-repair-hardening", CONFIRMATION]),
      "unknown_recipe",
    );
    expectGuardError(() => parseCommandArguments(["db-push", CONFIRMATION]), "unknown_recipe");
    expectGuardError(
      () => parseCommandArguments(["db-push-dry-run", CONFIRMATION, "--debug"]),
      "manual_confirmation_required",
    );
    expectGuardError(() => parseCommandArguments(["status", "--debug"]), "unexpected_arguments");
  });
});

describe("guardedRecipeArgs", () => {
  it("hard-blocks production before considering any confirmation", () => {
    expectGuardError(
      () =>
        guardedRecipeArgs(
          recipeInput({
            confirmProjectRef: PRODUCTION_PROJECT_REF,
            env: {},
            linkedProjectRef: PRODUCTION_PROJECT_REF,
          }),
        ),
      "production_link_hard_blocked",
    );
  });

  it("rejects unknown and malformed linked projects", () => {
    expectGuardError(
      () => guardedRecipeArgs(recipeInput({ linkedProjectRef: "a".repeat(20) })),
      "unapproved_linked_project",
    );
    expectGuardError(
      () => guardedRecipeArgs(recipeInput({ linkedProjectRef: "not-a-project-ref" })),
      "linked_project_ref_invalid",
    );
  });

  it.each([
    ["HOSTED_STAGING_PROJECT_REF", undefined, "hosted_staging_project_ref_missing"],
    ["HOSTED_STAGING_PROJECT_REF", PRODUCTION_PROJECT_REF, "staging_project_confirmation_mismatch"],
    ["SUPABASE_URL", undefined, "supabase_url_missing"],
    [
      "SUPABASE_URL",
      `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
      "staging_project_confirmation_mismatch",
    ],
    ["VITE_SUPABASE_URL", undefined, "vite_supabase_url_missing"],
    [
      "VITE_SUPABASE_URL",
      `https://${STAGING_PROJECT_REF}.supabase.co.evil.example`,
      "vite_supabase_url_invalid",
    ],
    ["VITE_SUPABASE_PROJECT_ID", undefined, "vite_supabase_project_id_missing"],
    ["VITE_SUPABASE_PROJECT_ID", PRODUCTION_PROJECT_REF, "staging_project_confirmation_mismatch"],
    [
      "SUPABASE_CLI_BINARY_OVERRIDE",
      "C:\\untrusted\\supabase.exe",
      "supabase_cli_binary_override_forbidden",
    ],
  ] as const)("rejects a mismatched %s contract", (name, value, code) => {
    const env = stagingEnvironment();
    if (value === undefined) {
      delete env[name];
    } else {
      env[name] = value;
    }

    expectGuardError(() => guardedRecipeArgs(recipeInput({ env })), code);
  });

  it("rejects a mismatched manual confirmation without echoing environment values", () => {
    const sensitiveMarker = "must-not-appear";
    const env = {
      ...stagingEnvironment(),
      SUPABASE_SERVICE_ROLE_KEY: sensitiveMarker,
    };

    try {
      guardedRecipeArgs(
        recipeInput({
          confirmProjectRef: PRODUCTION_PROJECT_REF,
          env,
        }),
      );
      throw new Error("expected guard error");
    } catch (error) {
      expect(error).toBeInstanceOf(SupabaseLinkedGuardError);
      expect((error as Error).message).toBe("staging_project_confirmation_mismatch");
      expect((error as Error).message).not.toContain(sensitiveMarker);
    }
  });

  it.each([
    ["migration-list", ["migration", "list", "--linked"]],
    ["db-push-dry-run", ["db", "push", "--linked", "--include-all", "--dry-run"]],
  ] as const)("maps %s to one fixed argument recipe", (recipe, expectedArgs) => {
    expect(guardedRecipeArgs(recipeInput({ recipe }))).toEqual(expectedArgs);
  });
});

describe("sanitizeSupabaseCliEnvironment", () => {
  it("passes only system, proxy and CLI-specific values to the child process", () => {
    const sanitized = sanitizeSupabaseCliEnvironment({
      Path: "C:\\safe-bin",
      SUPABASE_ACCESS_TOKEN: "synthetic-access-token",
      SUPABASE_CA_SKIP_VERIFY: "true",
      SUPABASE_DB_PASSWORD: "synthetic-db-password",
      SUPABASE_DEBUG: "true",
      SUPABASE_SERVICE_ROLE_KEY: "must-not-pass",
      TELEGRAM_BOT_TOKEN: "must-not-pass",
      OPENAI_API_KEY: "must-not-pass",
      VITE_SUPABASE_URL: STAGING_URL,
    });

    expect(sanitized).toEqual({
      Path: "C:\\safe-bin",
      SUPABASE_ACCESS_TOKEN: "synthetic-access-token",
      SUPABASE_DB_PASSWORD: "synthetic-db-password",
    });
  });
});

describe("executeFixedRecipe", () => {
  const cliInvocation: CliInvocation = {
    command: "safe-supabase-executable",
    prefixArgs: ["fixed-entrypoint.js"],
  };

  it("spawns the fixed recipe with shell disabled", () => {
    const executor = vi.fn<CommandExecutor>(() => ({ status: 0 }));
    const env = {
      ...stagingEnvironment(),
      Path: "C:\\safe-bin",
      SUPABASE_ACCESS_TOKEN: "synthetic-access-token",
      SUPABASE_SERVICE_ROLE_KEY: "must-not-pass",
      TELEGRAM_BOT_TOKEN: "must-not-pass",
    };

    const status = executeFixedRecipe(
      {
        cliInvocation,
        cwd: "C:\\safe-repo",
        env,
        recipeArgs: ["db", "push", "--linked", "--include-all", "--dry-run"],
      },
      executor,
    );

    expect(status).toBe(0);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor).toHaveBeenCalledWith(
      "safe-supabase-executable",
      ["fixed-entrypoint.js", "db", "push", "--linked", "--include-all", "--dry-run"],
      {
        cwd: "C:\\safe-repo",
        env: {
          Path: "C:\\safe-bin",
          SUPABASE_ACCESS_TOKEN: "synthetic-access-token",
        },
        shell: false,
        stdio: "inherit",
      },
    );
  });

  it("fails closed when the CLI cannot launch or return a status", () => {
    const env = stagingEnvironment();
    const recipeArgs = ["migration", "list", "--linked"];
    const launchFailure = vi.fn<CommandExecutor>(() => ({
      error: { code: "ENOENT" },
      status: null,
    }));

    expectGuardError(
      () =>
        executeFixedRecipe(
          {
            cliInvocation,
            cwd: "C:\\safe-repo",
            env,
            recipeArgs,
          },
          launchFailure,
        ),
      "supabase_cli_launch_failed",
    );

    const missingStatus = vi.fn<CommandExecutor>(() => ({ status: null }));
    expectGuardError(
      () =>
        executeFixedRecipe(
          {
            cliInvocation,
            cwd: "C:\\safe-repo",
            env,
            recipeArgs,
          },
          missingStatus,
        ),
      "supabase_cli_status_missing",
    );

    const signalled = vi.fn<CommandExecutor>(() => ({
      signal: "SIGTERM",
      status: null,
    }));
    expectGuardError(
      () =>
        executeFixedRecipe(
          {
            cliInvocation,
            cwd: "C:\\safe-repo",
            env,
            recipeArgs,
          },
          signalled,
        ),
      "supabase_cli_terminated",
    );
  });

  it("returns a nonzero CLI status without hiding the failure", () => {
    const executor = vi.fn<CommandExecutor>(() => ({ status: 1 }));
    expect(
      executeFixedRecipe(
        {
          cliInvocation,
          cwd: "C:\\safe-repo",
          env: stagingEnvironment(),
          recipeArgs: ["migration", "list", "--linked"],
        },
        executor,
      ),
    ).toBe(1);
  });
});

describe("runSupabaseLinkedCommand", () => {
  it.each([
    ["production", PRODUCTION_PROJECT_REF, "production_link_hard_blocked"],
    ["unknown", "a".repeat(20), "unapproved_linked_project"],
  ])("blocks a %s link before resolving or executing the CLI", (_, linkedProjectRef, code) => {
    const resolver = vi.fn(() => ({
      command: "must-not-resolve",
      prefixArgs: [],
    }));
    const executor = vi.fn<CommandExecutor>(() => ({ status: 0 }));
    const error = vi.fn();

    const status = runSupabaseLinkedCommand(
      {
        argv: ["migration-list", CONFIRMATION],
        env: stagingEnvironment(),
        repoRoot: "C:\\safe-repo",
      },
      {
        error,
        executor,
        log: vi.fn(),
        readLinkedProjectRef: () => linkedProjectRef,
        resolveCliInvocation: resolver,
      },
    );

    expect(status).toBe(2);
    expect(error).toHaveBeenCalledWith(`Supabase linked command refused: ${code}.`);
    expect(resolver).not.toHaveBeenCalled();
    expect(executor).not.toHaveBeenCalled();
  });

  it("validates staging before resolving and executing one fixed recipe", () => {
    const calls: string[] = [];
    const executor = vi.fn<CommandExecutor>(() => {
      calls.push("execute");
      return { status: 0 };
    });
    const resolver = vi.fn(() => {
      calls.push("resolve");
      return {
        command: "safe-supabase-executable",
        prefixArgs: ["fixed-entrypoint.js"],
      };
    });

    const status = runSupabaseLinkedCommand(
      {
        argv: ["migration-list", CONFIRMATION],
        env: stagingEnvironment(),
        repoRoot: "C:\\safe-repo",
      },
      {
        error: vi.fn(),
        executor,
        log: vi.fn(),
        readLinkedProjectRef: () => {
          calls.push("read");
          return STAGING_PROJECT_REF;
        },
        resolveCliInvocation: resolver,
      },
    );

    expect(status).toBe(0);
    expect(calls).toEqual(["read", "resolve", "execute"]);
    expect(executor).toHaveBeenCalledWith(
      "safe-supabase-executable",
      ["fixed-entrypoint.js", "migration", "list", "--linked"],
      expect.objectContaining({ shell: false }),
    );
  });

  it("reports status without resolving or executing the CLI", () => {
    const log = vi.fn();
    const resolver = vi.fn(() => ({
      command: "must-not-resolve",
      prefixArgs: [],
    }));
    const executor = vi.fn<CommandExecutor>(() => ({ status: 0 }));

    const status = runSupabaseLinkedCommand(
      {
        argv: ["status"],
        env: {},
        repoRoot: "C:\\safe-repo",
      },
      {
        error: vi.fn(),
        executor,
        log,
        readLinkedProjectRef: () => PRODUCTION_PROJECT_REF,
        resolveCliInvocation: resolver,
      },
    );

    expect(status).toBe(0);
    expect(log).toHaveBeenCalledWith(
      "Supabase linked environment: production; all guarded commands blocked.",
    );
    expect(resolver).not.toHaveBeenCalled();
    expect(executor).not.toHaveBeenCalled();
  });
});
