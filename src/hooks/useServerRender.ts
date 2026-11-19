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

type ServerRenderState =
  | RenderJob
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
    try {
      let result = await requestRenderJob(code, id, signal, job.input);
      // From this point forward the server has confirmed the job exists.
      // Status retries need only the UUID.
      job.input = undefined;
      update(result);
      while (result.status !== "ready" && result.status !== "failed") {
        await waitForPoll(signal);
        result = await requestRenderJob(code, id, signal);
        update(result);
      }
    } catch (error) {
      if (active.current !== controller) return;
      if (error instanceof HttpDeliveryError && !error.retryable) {
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
    if (!paymentCode || active.current || state?.status === "connection-lost") {
      return;
    }
    const storedId = readRenderJobId(paymentCode);
    if (storedId && storedId !== attempt.current?.id) {
      // Another tab may already have submitted a job for this payment.
      void run({ code: paymentCode, id: storedId });
      return;
    }
    const id = crypto.randomUUID();
    saveRenderJobId(paymentCode, id);
    void run({ code: paymentCode, id, input });
  }

  function retry() {
    if (attempt.current?.code === paymentCode) void run(attempt.current);
  }

  return { state, start, retry };
}
