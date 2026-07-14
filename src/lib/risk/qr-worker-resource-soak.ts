import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import process from "node:process";

import { encode as encodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";
import QRCode from "qrcode";

import { decodeQrFromDataUrl, terminateQrDecodeWorkerForOperationsProbe } from "./qr-decoder";

const MIB = 1024 * 1024;

interface CorpusCase {
  name: string;
  dataUrl: string;
  expectedValue?: string;
  expectedEmpty?: boolean;
  format: "png" | "jpeg" | "invalid";
}

export interface QrWorkerResourceSoakOptions {
  durationMs: number;
  progressIntervalMs: number;
  interCaseDelayMs: number;
  maxRssMb: number;
  maxRssGrowthMb: number;
  maxEventLoopP99Ms: number;
  maxDecodeLatencyMs: number;
  onProgress?: (progress: QrWorkerResourceSoakProgress) => void;
}

export interface QrWorkerResourceSoakProgress {
  elapsedSeconds: number;
  processed: number;
  expectedDecodePasses: number;
  expectedEmptyPasses: number;
  failures: number;
  rssMb: number;
  eventLoopP99Ms: number;
}

export interface QrWorkerResourceSoakSummary extends QrWorkerResourceSoakProgress {
  passed: boolean;
  failureReasons: string[];
  requestedDurationMs: number;
  elapsedMs: number;
  pngDecodePasses: number;
  jpegDecodePasses: number;
  crashObserved: boolean;
  interruptedJobFailedClosed: boolean;
  workerRecoveryPassed: boolean;
  queueBoundPassed: boolean;
  queueAccepted: number;
  queueRejected: number;
  maxRssMb: number;
  rssGrowthMb: number;
  heapUsedMb: number;
  externalMb: number;
  eventLoopMeanMs: number;
  eventLoopMaxMs: number;
  decodeLatencyP95Ms: number;
  decodeLatencyP99Ms: number;
  decodeLatencyMaxMs: number;
  cpuUserMs: number;
  cpuSystemMs: number;
}

export const DEFAULT_QR_WORKER_RESOURCE_SOAK_OPTIONS: QrWorkerResourceSoakOptions = {
  durationMs: 10 * 60 * 1000,
  progressIntervalMs: 60 * 1000,
  interCaseDelayMs: 100,
  maxRssMb: 512,
  maxRssGrowthMb: 192,
  maxEventLoopP99Ms: 250,
  maxDecodeLatencyMs: 2_000,
};

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function histogramMs(value: number): number {
  return Number.isFinite(value) ? round(value / 1_000_000) : 0;
}

function percentile(values: readonly number[], rank: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

async function qrPngDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256,
  });
}

async function qrJpegDataUrl(value: string): Promise<string> {
  const pngDataUrl = await qrPngDataUrl(value);
  const png = PNG.sync.read(Buffer.from(pngDataUrl.split(",")[1] ?? "", "base64"));
  const jpeg = encodeJpeg({ data: png.data, width: png.width, height: png.height }, 90);
  return `data:image/jpeg;base64,${jpeg.data.toString("base64")}`;
}

function blankPngDataUrl(width: number, height: number): string {
  const png = new PNG({ width, height });
  png.data.fill(255);
  return `data:image/png;base64,${PNG.sync.write(png, { colorType: 6 }).toString("base64")}`;
}

function oversizedPngHeaderDataUrl(): string {
  const bytes = Buffer.alloc(33);
  bytes.writeUInt32BE(0x89504e47, 0);
  bytes.writeUInt32BE(0x0d0a1a0a, 4);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(7000, 16);
  bytes.writeUInt32BE(7000, 20);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

async function buildCorpus(): Promise<{ cases: CorpusCase[]; largeBlank: CorpusCase }> {
  const safeUrl = "https://example.com/menu";
  const suspiciousUrl = "https://kapitalbank.uz.evil.top/login";
  const textValue = "Ishonch Guard controlled QR corpus";
  return {
    cases: [
      {
        name: "safe-url-png",
        dataUrl: await qrPngDataUrl(safeUrl),
        expectedValue: safeUrl,
        format: "png",
      },
      {
        name: "suspicious-url-png",
        dataUrl: await qrPngDataUrl(suspiciousUrl),
        expectedValue: suspiciousUrl,
        format: "png",
      },
      {
        name: "text-png",
        dataUrl: await qrPngDataUrl(textValue),
        expectedValue: textValue,
        format: "png",
      },
      {
        name: "safe-url-jpeg",
        dataUrl: await qrJpegDataUrl(safeUrl),
        expectedValue: safeUrl,
        format: "jpeg",
      },
      {
        name: "non-qr-png",
        dataUrl: blankPngDataUrl(512, 512),
        expectedEmpty: true,
        format: "png",
      },
      {
        name: "oversized-dimensions",
        dataUrl: oversizedPngHeaderDataUrl(),
        expectedEmpty: true,
        format: "invalid",
      },
      {
        name: "malformed-png",
        dataUrl: "data:image/png;base64,AAAA",
        expectedEmpty: true,
        format: "invalid",
      },
    ],
    largeBlank: {
      name: "high-resolution-non-qr-png",
      dataUrl: blankPngDataUrl(2000, 1800),
      expectedEmpty: true,
      format: "png",
    },
  };
}

export async function runQrWorkerResourceSoak(
  overrides: Partial<QrWorkerResourceSoakOptions> = {},
): Promise<QrWorkerResourceSoakSummary> {
  const options = { ...DEFAULT_QR_WORKER_RESOURCE_SOAK_OPTIONS, ...overrides };
  if (options.durationMs < 1 || options.interCaseDelayMs < 0) {
    throw new Error("duration must be positive and inter-case delay must not be negative");
  }

  const corpus = await buildCorpus();
  const initialMemory = process.memoryUsage();
  const initialCpu = process.cpuUsage();
  let lastMemory = initialMemory;
  let maxRss = initialMemory.rss;
  const latencies: number[] = [];
  let processed = 0;
  let expectedDecodePasses = 0;
  let expectedEmptyPasses = 0;
  let failures = 0;
  let pngDecodePasses = 0;
  let jpegDecodePasses = 0;
  let crashObserved = false;
  let interruptedJobFailedClosed = false;
  let workerRecoveryPassed = false;
  let queueBoundPassed = false;
  let queueAccepted = 0;
  let queueRejected = 0;

  const startedAt = performance.now();
  const endAt = startedAt + options.durationMs;
  let nextProgressAt = startedAt + options.progressIntervalMs;
  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  loopDelay.enable();

  const sampleResources = () => {
    lastMemory = process.memoryUsage();
    maxRss = Math.max(maxRss, lastMemory.rss);
  };
  const resourceTimer = setInterval(sampleResources, 1_000);
  resourceTimer.unref?.();

  const progressSnapshot = (): QrWorkerResourceSoakProgress => ({
    elapsedSeconds: round((performance.now() - startedAt) / 1_000),
    processed,
    expectedDecodePasses,
    expectedEmptyPasses,
    failures,
    rssMb: round(lastMemory.rss / MIB),
    eventLoopP99Ms: histogramMs(loopDelay.percentile(99)),
  });

  const decodeCase = async (entry: CorpusCase) => {
    const caseStartedAt = performance.now();
    const result = await decodeQrFromDataUrl(entry.dataUrl);
    latencies.push(performance.now() - caseStartedAt);
    processed += 1;

    if (entry.expectedValue) {
      if (result.values.includes(entry.expectedValue)) {
        expectedDecodePasses += 1;
        if (entry.format === "png") pngDecodePasses += 1;
        if (entry.format === "jpeg") jpegDecodePasses += 1;
      } else {
        failures += 1;
      }
      return;
    }
    if (entry.expectedEmpty) {
      if (result.values.length === 0 && result.urls.length === 0) expectedEmptyPasses += 1;
      else failures += 1;
    }
  };

  const runCrashProbe = async () => {
    const interrupted = decodeQrFromDataUrl(corpus.largeBlank.dataUrl);
    crashObserved = await terminateQrDecodeWorkerForOperationsProbe();
    const interruptedResult = await interrupted;
    processed += 1;
    interruptedJobFailedClosed =
      interruptedResult.values.length === 0 && interruptedResult.urls.length === 0;
    if (!crashObserved || !interruptedJobFailedClosed) failures += 1;

    const recoveryCase = corpus.cases[0]!;
    const recoveryStartedAt = performance.now();
    const recoveryResult = await decodeQrFromDataUrl(recoveryCase.dataUrl);
    latencies.push(performance.now() - recoveryStartedAt);
    processed += 1;
    workerRecoveryPassed = recoveryResult.values.includes(recoveryCase.expectedValue ?? "");
    if (workerRecoveryPassed) {
      expectedDecodePasses += 1;
      pngDecodePasses += 1;
    } else {
      failures += 1;
    }
  };

  const runQueueProbe = async () => {
    const entry = corpus.cases[0]!;
    const batchStartedAt = performance.now();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => decodeQrFromDataUrl(entry.dataUrl)),
    );
    const batchElapsed = performance.now() - batchStartedAt;
    latencies.push(batchElapsed);
    processed += results.length;
    queueAccepted = results.filter((result) =>
      result.values.includes(entry.expectedValue ?? ""),
    ).length;
    queueRejected = results.filter(
      (result) => result.values.length === 0 && result.urls.length === 0,
    ).length;
    expectedDecodePasses += queueAccepted;
    expectedEmptyPasses += queueRejected;
    pngDecodePasses += queueAccepted;
    queueBoundPassed = queueAccepted === 4 && queueRejected === 1;
    if (!queueBoundPassed) failures += 1;
  };

  let roundIndex = 0;
  try {
    for (const entry of corpus.cases) await decodeCase(entry);
    roundIndex = corpus.cases.length;

    while (performance.now() < endAt) {
      const elapsed = performance.now() - startedAt;
      if (!crashObserved && elapsed >= options.durationMs / 3) await runCrashProbe();
      if (!queueBoundPassed && elapsed >= (options.durationMs * 2) / 3) await runQueueProbe();

      await decodeCase(corpus.cases[roundIndex % corpus.cases.length]!);
      roundIndex += 1;
      if (roundIndex % 25 === 0) await decodeCase(corpus.largeBlank);

      if (
        options.progressIntervalMs > 0 &&
        performance.now() >= nextProgressAt &&
        options.onProgress
      ) {
        sampleResources();
        options.onProgress(progressSnapshot());
        nextProgressAt += options.progressIntervalMs;
      }
      await delay(options.interCaseDelayMs);
    }

    if (!crashObserved) await runCrashProbe();
    if (!queueBoundPassed) await runQueueProbe();
  } finally {
    clearInterval(resourceTimer);
    await terminateQrDecodeWorkerForOperationsProbe();
    sampleResources();
    loopDelay.disable();
  }

  const elapsedMs = performance.now() - startedAt;
  const cpu = process.cpuUsage(initialCpu);
  const decodeLatencyP95Ms = percentile(latencies, 0.95);
  const decodeLatencyP99Ms = percentile(latencies, 0.99);
  const decodeLatencyMaxMs = Math.max(0, ...latencies);
  const eventLoopP99Ms = histogramMs(loopDelay.percentile(99));
  const eventLoopMeanMs = histogramMs(loopDelay.mean);
  const eventLoopMaxMs = histogramMs(loopDelay.max);
  const rssGrowthMb = (maxRss - initialMemory.rss) / MIB;
  const failureReasons: string[] = [];

  if (elapsedMs < options.durationMs) failureReasons.push("duration_short");
  if (failures !== 0) failureReasons.push("corpus_failure");
  if (pngDecodePasses === 0) failureReasons.push("png_decode_missing");
  if (jpegDecodePasses === 0) failureReasons.push("jpeg_decode_missing");
  if (!crashObserved) failureReasons.push("worker_crash_missing");
  if (!interruptedJobFailedClosed) failureReasons.push("interrupted_job_not_fail_closed");
  if (!workerRecoveryPassed) failureReasons.push("worker_recovery_failed");
  if (!queueBoundPassed) failureReasons.push("queue_bound_failed");
  if (maxRss / MIB > options.maxRssMb) failureReasons.push("rss_limit_exceeded");
  if (rssGrowthMb > options.maxRssGrowthMb) failureReasons.push("rss_growth_exceeded");
  if (eventLoopP99Ms > options.maxEventLoopP99Ms) {
    failureReasons.push("event_loop_p99_exceeded");
  }
  if (decodeLatencyMaxMs > options.maxDecodeLatencyMs) {
    failureReasons.push("decode_latency_exceeded");
  }

  return {
    ...progressSnapshot(),
    passed: failureReasons.length === 0,
    failureReasons,
    requestedDurationMs: options.durationMs,
    elapsedMs: round(elapsedMs),
    pngDecodePasses,
    jpegDecodePasses,
    crashObserved,
    interruptedJobFailedClosed,
    workerRecoveryPassed,
    queueBoundPassed,
    queueAccepted,
    queueRejected,
    maxRssMb: round(maxRss / MIB),
    rssGrowthMb: round(rssGrowthMb),
    heapUsedMb: round(lastMemory.heapUsed / MIB),
    externalMb: round(lastMemory.external / MIB),
    eventLoopMeanMs,
    eventLoopMaxMs,
    decodeLatencyP95Ms: round(decodeLatencyP95Ms),
    decodeLatencyP99Ms: round(decodeLatencyP99Ms),
    decodeLatencyMaxMs: round(decodeLatencyMaxMs),
    cpuUserMs: round(cpu.user / 1_000),
    cpuSystemMs: round(cpu.system / 1_000),
  };
}
