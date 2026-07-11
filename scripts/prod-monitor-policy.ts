export type MonitorSeverity = "ok" | "warn" | "fail";

export interface MonitorCheck {
  name: string;
  severity: MonitorSeverity;
  detail: string;
}

export function skippedSecretMonitorCheck(
  name: string,
  secretName: string,
  required: boolean,
): MonitorCheck {
  return {
    name,
    severity: required ? "fail" : "warn",
    detail: `skipped: ${secretName} is not set`,
  };
}

export function shouldFailMonitor(checks: readonly MonitorCheck[], failOnWarn: boolean): boolean {
  return checks.some(
    (check) => check.severity === "fail" || (failOnWarn && check.severity === "warn"),
  );
}
