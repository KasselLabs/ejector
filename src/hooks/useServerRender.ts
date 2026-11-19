import { useCallback, useEffect, useRef, useState } from "react";
import { HttpDeliveryError } from "@/lib/delivery/retry";
import {
  clearRenderJobId,
  readRenderJobId,
  requestRenderJob,
  saveRenderJobId,
  type RenderJob,
  type ServerRenderInput,
} from "@/lib/render/serverRender";

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 180_000;

type ReadyRenderJob = Extract<RenderJob, { status: "ready" }>;
type ServerRenderState =
  | RenderJob
  | (Omit<ReadyRenderJob, "emailStatus"> & { emailStatus: "unknown" })
  | { status: "connecting" | "connection-lost" | "unavailable" };

interface Attempt {
  code: string;
  id: string;
  input?: ServerRenderInput;
}

function waitForPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, POLL_INTERVAL_MS);
    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

const isUnavailable = (error: unknown) =>
  error instanceof HttpDeliveryError && !error.retryable;

export function useServerRender(paymentCode: string | null) {
  const [current, setCurrent] = useState<{
    code: string;
    state: ServerRenderState;
  } | null>(null);
  const active = useRef<AbortController | null>(null);
  const attempt = useRef<Attempt | null>(null);

  const run = useCallback(async (job: Attempt) => {
    if (active.current) return;
    attempt.current = job;
    const controller = new AbortController();
    active.current = controller;
    const { signal } = controller;
    const { code, id } = job;
    const deadline = setTimeout(() => controller.abort(), TIMEOUT_MS);

    function update(state: ServerRenderState) {
      if (active.current === controller) setCurrent({ code, state });
    }

    update({ status: "connecting" });
    let readyJob: ReadyRenderJob | undefined;
    try {
      let result = await requestRenderJob(code, id, signal, job.input);
      if (active.current !== controller) return;
      // Only an acknowledged submission can replace the shared resume ID.
      if (job.input) saveRenderJobId(code, id);
      job.input = undefined;
      update(result);

      while (result.status !== "failed") {
        if (result.status === "ready") {
          readyJob = result;
          if (result.emailStatus !== "pending") break;
        }
        await waitForPoll(signal);
        try {
          const next = await requestRenderJob(code, id, signal);
          // A stale status read cannot undo an already verified download.
          if (readyJob && next.status !== "ready") continue;
          result = next;
          update(result);
        } catch (error) {
          if (!readyJob || signal.aborted || isUnavailable(error)) throw error;
          // Keep the ready link while retrying an interrupted email check.
        }
      }
    } catch (error) {
      if (active.current !== controller) return;
      if (readyJob) {
        update({ ...readyJob, emailStatus: "unknown" });
      } else if (isUnavailable(error)) {
        clearRenderJobId(code, id);
        attempt.current = null;
        update({ status: "unavailable" });
      } else {
        update({ status: "connection-lost" });
      }
    } finally {
      clearTimeout(deadline);
      if (active.current === controller) active.current = null;
    }
  }, []);

  useEffect(() => {
    if (!paymentCode) return;
    const id = readRenderJobId(paymentCode);
    // A reload checks the existing job using its UUID only.
    if (id) void run({ code: paymentCode, id });
    return () => {
      active.current?.abort();
      active.current = null;
      attempt.current = null;
    };
  }, [paymentCode, run]);

  const state = current?.code === paymentCode ? current.state : null;

  function start(input: ServerRenderInput) {
    if (!paymentCode || state?.status === "connection-lost") return;
    if (active.current) {
      if (state?.status !== "ready" || state.id !== attempt.current?.id) return;
      // A new explicit request can replace the last job's email status poll.
      active.current.abort();
      active.current = null;
    }
    const storedId = readRenderJobId(paymentCode);
    if (storedId && storedId !== attempt.current?.id) {
      // Another tab may already have submitted a job for this payment.
      void run({ code: paymentCode, id: storedId });
      return;
    }
    const id = crypto.randomUUID();
    void run({ code: paymentCode, id, input });
  }

  function retry() {
    if (attempt.current?.code === paymentCode) void run(attempt.current);
  }

  return { state, start, retry };
}
