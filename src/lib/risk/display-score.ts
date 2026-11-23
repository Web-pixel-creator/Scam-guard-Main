/**
 * Rule weights are summed without an upper bound (an APK request plus an APK
 * link already exceeds 100), so every user-facing "N / 100" must use this.
 */
export function displayRiskScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}
