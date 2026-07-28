# Paid Video Email Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist every paid browser-rendered Ejector MP4, email its permanent unguessable URL to the payment email exactly once during normal retries, and delay the local download until Mailgun accepts the message.

**Architecture:** Ejector uploads its exact Blob directly through a payment-backend presigned URL. Payment-backend owns the delivery row, payment-derived recipient, storage verification, email rendering, and receipt consumer; mail-server retries tracked messages and emits a durable Mailgun-acceptance receipt. The browser reuses one delivery UUID and Blob across retries and polls the backend state instead of holding a long HTTP request open.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest/MSW/Playwright; Express 5, TypeScript 6, PostgreSQL, AWS SDK v3, Jest, RabbitMQ; legacy CommonJS mail-server, Jest 24, Mailgun.

## Global Constraints

- Never add a server-side video renderer or transcoder; upload the exact MP4 Blob produced by `@remotion/web-renderer`.
- Apply delivery only to paid MP4 exports; free GIF behavior stays unchanged.
- Use the payment row's email exclusively. Delivery requests and responses must not accept or expose an email.
- Derive entitlement from the pre-discount price: `dollar_value * 100 + discount_amount` cents.
- One browser render creates one UUID; all automatic and manual retries reuse it.
- Use one initial attempt plus three retries after approximately 1 s, 2 s, and 4 s for retryable client operations and tracked Mailgun submission.
- Treat Mailgun acceptance as completion; the local download starts only after `email_accepted`.
- Public object URLs never expire and contain at least 128 bits of random entropy, with no email, payment code, or database ID.
- Keep user-facing finishing copy generic; never display “uploading” or “emailing.”
- Use shadcn Dialog for manual retry; never use browser-native modal APIs.
- Use npm in every repository, preserve TypeScript strictness, and do not commit `.env` files or credentials.
- Update README, `.env.example`, OpenAPI, schema/migration, and mail message documentation with their owning code.
- Deploy in this order: mail-server, payment-backend schema/API, then Ejector.

---

## File structure

### `../mail-server`

- `packages/amqp/trackedDelivery.js` — pure retry and receipt state machine.
- `packages/amqp/trackedDelivery.test.js` — provider retry and receipt tests.
- `packages/amqp/index.js` — RabbitMQ consumer, confirm-channel receipt publisher,
  compatibility path for untracked messages.
- `package.json` — include AMQP tests in the root test command.
- `config/{default,kassel-labs,test}.json` — configured receipt queue name.
- `README.md` — documented tracked-message envelope and confirmation semantics.

### `../payment-backend`

- `database-schema/migrations/2026-07-28-ejector-delivery.sql` — deployable additive
  migration.
- `database-schema/database.sql` — canonical schema for new environments.
- `src/ejectorDelivery/types.ts` — shared row, API, receipt, and dependency types.
- `src/ejectorDelivery/repository.ts` — payment lookup and delivery transitions.
- `src/ejectorDelivery/storage.ts` — S3 client, presigning, URL creation, and `HEAD`
  verification.
- `src/ejectorDelivery/emailTemplate.ts` — escaped Kassel Labs HTML/text renderer.
- `src/ejectorDelivery/mailQueue.ts` — confirm-channel email publisher and receipt
  queue consumer.
- `src/ejectorDelivery/service.ts` — entitlement, idempotency, and delivery orchestration.
- `src/ejectorDelivery/api.ts` — rate-limited REST routes and safe response mapping.
- `test/ejectorDelivery*.test.ts` — isolated repository, storage, email, service, API,
  and receipt tests.
- `index.ts` — mount API and start the receipt consumer only in the production entrypoint.
- `package.json` / `package-lock.json` — AWS SDK v3 dependencies.
- `.env.example`, `README.md`, `openapi.json` — configuration and contract docs.

### `ejector`

- `src/lib/delivery/types.ts` — browser delivery contracts and typed errors.
- `src/lib/delivery/checksum.ts` — Blob SHA-256.
- `src/lib/delivery/retry.ts` — retry classification and injectable backoff.
- `src/lib/delivery/client.ts` — initialize/upload/complete/status/retry HTTP calls.
- `src/lib/delivery/finishVideoDelivery.ts` — one-render orchestration and polling.
- `src/lib/delivery/pendingDelivery.ts` — local recovery record.
- colocated `*.test.ts` / `*.dom.test.ts` files for each unit.
- `src/hooks/useFileGeneration.ts` and test — retain Blob/UUID, finish before download,
  retry without re-render.
- `src/components/ErrorDialog.tsx`, `DownloadSection.tsx`, and tests — retry action and
  generic finishing UI.
- `src/locales/{en,pt-BR}.json` — finishing and retry copy.
- `README.md`, `CLAUDE.md` — architecture, storage, and recovery behavior.

---

### Task 1: Add tracked Mailgun delivery and durable receipts

**Repository:** `../mail-server`

**Files:**
- Create: `packages/amqp/trackedDelivery.js`
- Create: `packages/amqp/trackedDelivery.test.js`
- Create: `packages/amqp/index.test.js`
- Modify: `packages/amqp/index.js`
- Modify: `package.json`
- Modify: `config/default.json`
- Modify: `config/kassel-labs.json`
- Modify: `config/test.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: existing `sendMail(payload)` and AMQP `email` messages.
- Produces:
  `deliverTracked({ content, send, publishReceipt, sleep, now }): Promise<void>`.
- Receipt shape:
  `{ deliveryId, status: "accepted" | "failed", attempts, occurredAt, error? }`.

- [ ] **Step 1: Write retry and receipt tests**

```js
const { deliverTracked } = require('./trackedDelivery');

it('retries 1s, 2s, 4s and publishes one accepted receipt', async () => {
  const send = jest.fn()
    .mockRejectedValueOnce(new Error('temporary'))
    .mockResolvedValueOnce([{ id: '<mailgun-id>' }]);
  const sleep = jest.fn().mockResolvedValue();
  const publishReceipt = jest.fn().mockResolvedValue();

  await deliverTracked({
    content: {
      payload: { to: 'paid@example.com' },
      deliveryReceipt: { deliveryId: 'd1', queue: 'EjectorDeliveryReceipts_dev' },
    },
    send,
    sleep,
    publishReceipt,
    now: () => new Date('2026-07-28T12:00:00Z'),
  });

  expect(send).toHaveBeenCalledTimes(2);
  expect(sleep).toHaveBeenCalledWith(1000);
  expect(publishReceipt).toHaveBeenCalledWith(
    'EjectorDeliveryReceipts_dev',
    expect.objectContaining({ deliveryId: 'd1', status: 'accepted', attempts: 2 }),
  );
});

it('publishes failed after the initial call and all three retries', async () => {
  const send = jest.fn().mockRejectedValue(new Error('provider body must stay private'));
  const publishReceipt = jest.fn().mockResolvedValue();
  await deliverTracked({
    content: {
      payload: { to: 'paid@example.com' },
      deliveryReceipt: { deliveryId: 'd2', queue: 'EjectorDeliveryReceipts_dev' },
    },
    send,
    sleep: jest.fn().mockResolvedValue(),
    publishReceipt,
    now: () => new Date('2026-07-28T12:00:00Z'),
  });
  expect(send).toHaveBeenCalledTimes(4);
  expect(publishReceipt).toHaveBeenCalledWith(
    'EjectorDeliveryReceipts_dev',
    expect.objectContaining({
      deliveryId: 'd2',
      status: 'failed',
      attempts: 4,
      error: 'Email provider rejected the message.',
    }),
  );
});
```

- [ ] **Step 2: Run the focused tests and verify red**

Run:

```bash
cd ../mail-server
npx jest packages/amqp/trackedDelivery.test.js --runInBand
```

Expected: FAIL because `trackedDelivery.js` does not exist.

- [ ] **Step 3: Implement the pure tracked-delivery state machine**

```js
const RETRY_DELAYS_MS = [1000, 2000, 4000];

async function deliverTracked({
  content, send, publishReceipt, sleep, now,
}) {
  let attempts = 0;
  for (;;) {
    attempts += 1;
    try {
      const result = await send(content.payload);
      if (!Array.isArray(result) || result.length === 0) {
        throw new Error('No valid recipient');
      }
      await publishReceipt(content.deliveryReceipt.queue, {
        deliveryId: content.deliveryReceipt.deliveryId,
        status: 'accepted',
        attempts,
        occurredAt: now().toISOString(),
      });
      return;
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempts - 1];
      if (delay !== undefined) {
        await sleep(delay);
        continue;
      }
      await publishReceipt(content.deliveryReceipt.queue, {
        deliveryId: content.deliveryReceipt.deliveryId,
        status: 'failed',
        attempts,
        occurredAt: now().toISOString(),
        error: 'Email provider rejected the message.',
      });
      return;
    }
  }
}

module.exports = { RETRY_DELAYS_MS, deliverTracked };
```

- [ ] **Step 4: Integrate confirm-channel receipt publication**

Refactor `packages/amqp/index.js` so tracked messages:

```js
const { deliverTracked } = require('./trackedDelivery');

async function publishReceipt(channel, configuredQueue, requestedQueue, receipt) {
  if (requestedQueue !== configuredQueue) {
    throw new Error('Invalid delivery receipt queue');
  }
  await channel.assertQueue(configuredQueue, { durable: true });
  channel.sendToQueue(
    configuredQueue,
    Buffer.from(JSON.stringify(receipt)),
    { persistent: true, contentType: 'application/json' },
  );
  await channel.waitForConfirms();
}
```

Create a confirm channel, call `deliverTracked` for messages with
`deliveryReceipt`, and `ack(message)` only after the receipt confirm resolves.
On receipt-publication failure call `nack(message, false, true)`. Preserve the
existing untracked `email` and `template` path. Log only the delivery ID for
tracked messages.

Set `config.amqp.deliveryReceiptQueue` to
`EjectorDeliveryReceipts_dev` in default/test and
`EjectorDeliveryReceipts` in `kassel-labs.json`.

- [ ] **Step 5: Test acknowledgment ordering**

Export an injected `handleMessage` without starting `main()` during imports,
then verify the confirm happens first:

```js
it('acks a tracked message only after the receipt publish is confirmed', async () => {
  const order = [];
  const channel = {
    assertQueue: jest.fn().mockResolvedValue(),
    sendToQueue: jest.fn(),
    waitForConfirms: jest.fn(async () => { order.push('confirmed'); }),
    ack: jest.fn(() => { order.push('acked'); }),
    nack: jest.fn(),
  };
  await handleMessage({
    channel,
    message: trackedMessage,
    configuredReceiptQueue: 'EjectorDeliveryReceipts_dev',
    send: jest.fn().mockResolvedValue([{ id: '<provider-id>' }]),
    sleep: jest.fn().mockResolvedValue(),
    now: () => new Date('2026-07-28T12:00:00Z'),
  });
  expect(order).toEqual(['confirmed', 'acked']);
});
```

- [ ] **Step 6: Expand tests, document the envelope, and run checks**

Change the root script to:

```json
"test": "jest --roots ./packages/core ./packages/amqp"
```

Add the tracked `deliveryReceipt` request and accepted/failed receipt examples
to README, including the configured queue allowlist and Mailgun-acceptance
meaning.

Run:

```bash
npm test -- --runInBand
npm run lint
```

Expected: all core snapshot tests and new AMQP tests pass.

- [ ] **Step 7: Commit the mail-server behavior**

```bash
git add package.json packages/amqp config README.md
git commit -m "feat: confirm tracked email delivery"
```

---

### Task 2: Add the payment delivery schema and repository

**Repository:** `../payment-backend`

**Files:**
- Create: `database-schema/migrations/2026-07-28-ejector-delivery.sql`
- Modify: `database-schema/database.sql`
- Create: `src/ejectorDelivery/types.ts`
- Create: `src/ejectorDelivery/repository.ts`
- Create: `test/ejectorDeliveryRepository.test.ts`

**Interfaces:**
- Produces `findActiveEjectorPayment(code, now)`,
  `createOrGetDelivery(input)`, `findAuthorizedDelivery(code, id)`,
  `markUploaded(id)`, `claimEmailPending(id)`, `markDeliveryFailed(id, stage, error)`,
  and `applyMailReceipt(receipt)`.
- `PaymentEntitlement.baseAmountCents` is
  `Math.round(Number(dollar_value) * 100) + Number(discount_amount ?? 0)`.

- [ ] **Step 1: Write repository tests for entitlement and idempotency**

```ts
it('restores the pre-discount Full HD entitlement', async () => {
  mockedSql.mockResolvedValueOnce([{
    id: 'p1',
    email: 'paid@example.com',
    dollar_value: '4',
    discount_amount: 100,
    created_at: new Date(),
  }]);
  const payment = await findActiveEjectorPayment('code', new Date());
  expect(payment?.baseAmountCents).toBe(500);
  expect(payment?.email).toBe('paid@example.com');
});

it('returns the existing row for an identical delivery UUID', async () => {
  mockedSql
    .mockResolvedValueOnce([existingDelivery])
    .mockResolvedValueOnce([existingDelivery]);
  const result = await createOrGetDelivery(input);
  expect(result).toEqual({ delivery: existingDelivery, created: false });
});

it('makes duplicate accepted receipts a no-op', async () => {
  mockedSql.mockResolvedValueOnce([{ ...existingDelivery, status: 'email_accepted' }]);
  await expect(applyMailReceipt(acceptedReceipt)).resolves.toMatchObject({
    status: 'email_accepted',
  });
});
```

- [ ] **Step 2: Run the repository test and verify red**

```bash
npm test -- --runInBand test/ejectorDeliveryRepository.test.ts
```

Expected: FAIL because the delivery modules do not exist.

- [ ] **Step 3: Add the additive SQL migration**

The migration and canonical schema must create:

```sql
CREATE TABLE IF NOT EXISTS ejector_delivery (
  id UUID PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payment(id),
  email TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('hd', 'full-hd')),
  object_key TEXT NOT NULL UNIQUE,
  download_url TEXT NOT NULL UNIQUE,
  expected_bytes BIGINT NOT NULL CHECK (expected_bytes > 0),
  checksum TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'uploaded', 'email_pending', 'email_accepted', 'failed')),
  failed_stage TEXT,
  last_error TEXT,
  mail_attempts INTEGER NOT NULL DEFAULT 0,
  mail_message_id TEXT NOT NULL UNIQUE,
  completion_expires_at TIMESTAMPTZ NOT NULL,
  uploaded_at TIMESTAMPTZ,
  mail_queued_at TIMESTAMPTZ,
  mail_accepted_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ejector_delivery_payment_idx
  ON ejector_delivery(payment_id);
CREATE INDEX IF NOT EXISTS ejector_delivery_pending_idx
  ON ejector_delivery(status) WHERE status IN ('uploaded', 'email_pending', 'failed');
```

- [ ] **Step 4: Implement types and conditional transitions**

Use typed repository inputs such as:

```ts
export type DeliveryStatus =
  | 'created' | 'uploaded' | 'email_pending' | 'email_accepted' | 'failed';
export type DeliveryStage = 'upload' | 'email';
export type DeliveryTier = 'hd' | 'full-hd';

export interface MailReceipt {
  deliveryId: string;
  status: 'accepted' | 'failed';
  attempts: number;
  occurredAt: string;
  error?: string;
}
```

Every transition uses a conditional `UPDATE ... WHERE id = ... AND status IN (...)`
and returns the current row when another request already completed the transition.
Conflicting immutable metadata raises `DeliveryConflictError`.

- [ ] **Step 5: Run repository, type, and lint checks**

```bash
npm test -- --runInBand test/ejectorDeliveryRepository.test.ts
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit the schema and repository**

```bash
git add database-schema src/ejectorDelivery/types.ts \
  src/ejectorDelivery/repository.ts test/ejectorDeliveryRepository.test.ts
git commit -m "feat: persist ejector video deliveries"
```

---

### Task 3: Add constrained direct-to-storage uploads

**Repository:** `../payment-backend`

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/ejectorDelivery/storage.ts`
- Create: `test/ejectorDeliveryStorage.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces:
  `createUploadTarget(input): Promise<{ uploadUrl, uploadHeaders, downloadUrl }>`
  and `verifyUploadedObject(input): Promise<void>`.
- Throws `StorageVerificationError` for missing or mismatched objects.

- [ ] **Step 1: Install the AWS SDK v3 packages**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Expected: only `package.json` and `package-lock.json` dependency changes.

- [ ] **Step 2: Write storage tests with mocked SDK commands**

```ts
it('presigns an immutable public MP4 with the supplied checksum', async () => {
  const target = await createUploadTarget({
    objectKey: 'ejector/videos/random.mp4',
    contentLength: 1234,
    checksum: 'abc=',
  });
  expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
    Key: 'ejector/videos/random.mp4',
    ContentType: 'video/mp4',
    ContentLength: 1234,
    ChecksumSHA256: 'abc=',
    ACL: 'public-read',
  }));
  expect(target.downloadUrl).toBe(
    'https://videos.example/ejector/videos/random.mp4',
  );
});

it('rejects a HEAD response whose checksum differs', async () => {
  mockedSend.mockResolvedValue({
    ContentLength: 1234,
    ContentType: 'video/mp4',
    ChecksumSHA256: 'different=',
  });
  await expect(verifyUploadedObject(expected))
    .rejects.toThrow('Uploaded video checksum does not match');
});
```

- [ ] **Step 3: Run the focused storage tests and verify red**

```bash
npm test -- --runInBand test/ejectorDeliveryStorage.test.ts
```

Expected: FAIL because `storage.ts` does not exist.

- [ ] **Step 4: Implement presign and `HEAD` verification**

Read these server-only variables:

```text
EJECTOR_STORAGE_ENDPOINT
EJECTOR_STORAGE_REGION
EJECTOR_STORAGE_BUCKET
EJECTOR_STORAGE_ACCESS_KEY_ID
EJECTOR_STORAGE_SECRET_ACCESS_KEY
EJECTOR_STORAGE_PUBLIC_BASE_URL
EJECTOR_UPLOAD_EXPIRES_SECONDS
EJECTOR_MAX_VIDEO_BYTES
```

Use `PutObjectCommand`, `HeadObjectCommand`, and `getSignedUrl`. Require
`video/mp4`, exact content length, `ChecksumSHA256`, immutable key, and
`ContentDisposition: attachment; filename="ejector-video.mp4"`. Normalize the
public base URL once and URL-encode path segments without encoding `/`.

- [ ] **Step 5: Run storage and repository checks**

```bash
npm test -- --runInBand test/ejectorDeliveryStorage.test.ts
npm run typecheck
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit the storage boundary**

```bash
git add package.json package-lock.json .env.example \
  src/ejectorDelivery/storage.ts test/ejectorDeliveryStorage.test.ts
git commit -m "feat: presign ejector video uploads"
```

---

### Task 4: Render and queue the delivery email

**Repository:** `../payment-backend`

**Files:**
- Create: `src/ejectorDelivery/emailTemplate.ts`
- Create: `src/ejectorDelivery/mailQueue.ts`
- Create: `test/ejectorDeliveryEmail.test.ts`
- Create: `test/ejectorDeliveryMailQueue.test.ts`

**Interfaces:**
- Produces:
  `renderVideoReadyEmail({ downloadUrl }): { subject, html, text }`.
- Produces:
  `publishVideoReadyEmail(delivery): Promise<void>`.
- Queue envelope matches Task 1 and uses
  `<ejector-delivery-${delivery.id}@kassellabs.io>` as the stable Message-ID.

- [ ] **Step 1: Write escaping, content, and queue-envelope tests**

```ts
it('renders a direct button and plain-text fallback URL', () => {
  const email = renderVideoReadyEmail({
    downloadUrl: 'https://videos.example/ejector/videos/token.mp4',
  });
  expect(email.subject).toBe('Your Ejector video is ready');
  expect(email.html).toContain('Download your video');
  expect(email.html).toContain('https://videos.example/ejector/videos/token.mp4');
  expect(email.text).toContain('https://videos.example/ejector/videos/token.mp4');
  expect(email.html).not.toContain('expires');
});

it('publishes the payment email with receipt metadata and a persistent message', async () => {
  await publishVideoReadyEmail(delivery);
  expect(mockSendToQueue).toHaveBeenCalledWith(
    'Mails_dev',
    expect.any(Buffer),
    expect.objectContaining({ persistent: true, contentType: 'application/json' }),
  );
  const message = JSON.parse(mockSendToQueue.mock.calls[0][1].toString());
  expect(message.payload.to).toBe('paid@example.com');
  expect(message.payload['h:Message-Id'])
    .toBe('<ejector-delivery-d1@kassellabs.io>');
  expect(message.deliveryReceipt)
    .toEqual({ deliveryId: 'd1', queue: 'EjectorDeliveryReceipts_dev' });
});
```

- [ ] **Step 2: Run focused tests and verify red**

```bash
npm test -- --runInBand test/ejectorDeliveryEmail.test.ts \
  test/ejectorDeliveryMailQueue.test.ts
```

Expected: FAIL because the renderer and publisher do not exist.

- [ ] **Step 3: Implement the self-contained branded template**

Build HTML with inline email-safe styles, a Kassel Labs header, one
“Download your video” CTA, the escaped fallback URL, and support copy. Use an
`escapeHtml` helper for every interpolated value and produce a complete
plain-text alternative. Do not include recipient, payment code, object key, or
expiration claims in the content.

- [ ] **Step 4: Implement confirm-channel queue publication**

Use `AMQP_BROKER_URL`, queue `Mails` in production and `Mails_dev` otherwise,
and receipt queue `EJECTOR_MAIL_RECEIPT_QUEUE` with the same environment
defaulting. Assert durable queues, publish with `persistent: true`, call
`waitForConfirms()`, and close one-shot publisher connections in `finally`.

- [ ] **Step 5: Run email, type, lint, and build checks**

```bash
npm test -- --runInBand test/ejectorDeliveryEmail.test.ts \
  test/ejectorDeliveryMailQueue.test.ts
npm run typecheck
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit the mail producer**

```bash
git add src/ejectorDelivery/emailTemplate.ts src/ejectorDelivery/mailQueue.ts \
  test/ejectorDeliveryEmail.test.ts test/ejectorDeliveryMailQueue.test.ts
git commit -m "feat: queue ejector video-ready emails"
```

---

### Task 5: Implement the idempotent delivery service and API

**Repository:** `../payment-backend`

**Files:**
- Create: `src/ejectorDelivery/service.ts`
- Create: `src/ejectorDelivery/api.ts`
- Create: `test/ejectorDeliveryService.test.ts`
- Create: `test/ejectorDeliveryApi.test.ts`
- Modify: `index.ts`

**Interfaces:**
- Produces service methods:
  `initialize(input)`, `complete(code, id)`, `getStatus(code, id)`,
  and `retry(code, id)`.
- Mounts:
  `POST /payment/ejector/:code/deliveries`,
  `POST /payment/ejector/:code/deliveries/:id/complete`,
  `GET /payment/ejector/:code/deliveries/:id`,
  and `POST /payment/ejector/:code/deliveries/:id/retry`.

- [ ] **Step 1: Write service tests for the complete state machine**

```ts
it('uses payment email and reconstructed Full HD entitlement', async () => {
  deps.findActivePayment.mockResolvedValue({
    id: 'p1', code: 'code', email: 'paid@example.com', baseAmountCents: 500,
  });
  const result = await service.initialize({
    code: 'code',
    deliveryId: UUID,
    tier: 'full-hd',
    contentType: 'video/mp4',
    contentLength: 1234,
    checksum: VALID_CHECKSUM,
  });
  expect(deps.createOrGetDelivery).toHaveBeenCalledWith(
    expect.objectContaining({ paymentId: 'p1', email: 'paid@example.com' }),
  );
  expect(result).not.toHaveProperty('email');
});

it('never republishes after email acceptance', async () => {
  deps.findAuthorizedDelivery.mockResolvedValue(acceptedDelivery);
  await service.retry('code', UUID);
  expect(deps.publishEmail).not.toHaveBeenCalled();
});

it('verifies storage before publishing', async () => {
  deps.findAuthorizedDelivery.mockResolvedValue(createdDelivery);
  await service.complete('code', UUID);
  expect(deps.verifyUpload.mock.invocationCallOrder[0])
    .toBeLessThan(deps.publishEmail.mock.invocationCallOrder[0]);
});
```

- [ ] **Step 2: Run the service tests and verify red**

```bash
npm test -- --runInBand test/ejectorDeliveryService.test.ts
```

Expected: FAIL because `service.ts` does not exist.

- [ ] **Step 3: Implement validation and orchestration**

Use a dependency-injected factory:

```ts
export function createDeliveryService(deps: DeliveryServiceDependencies) {
  return {
    initialize: (input: InitializeDeliveryInput) => initialize(deps, input),
    complete: (code: string, id: string) => complete(deps, code, id),
    getStatus: (code: string, id: string) => getStatus(deps, code, id),
    retry: (code: string, id: string) => retry(deps, code, id),
  };
}
```

Validate UUID, `video/mp4`, base64 SHA-256, configured maximum bytes, active
payment, and tier thresholds (`hd >= 300`, `full-hd >= 500`). Generate the
object token server-side with `nanoid(32)`. Initialize has a 24-hour completion
deadline. Complete verifies `HEAD`, marks uploaded, conditionally claims
`email_pending`, then publishes. Publish failure marks the email stage failed.
Retry resumes upload or email without changing immutable identity.

- [ ] **Step 4: Write API tests**

```ts
it('rejects an email field instead of trusting it', async () => {
  const res = await request(app)
    .post(`/payment/ejector/code/deliveries`)
    .send({ ...validBody, email: 'attacker@example.com' });
  expect(res.status).toBe(400);
});

it('returns the same accepted delivery on duplicate completion', async () => {
  mockedComplete.mockResolvedValue(acceptedPublicDelivery);
  const first = await request(app).post(completePath);
  const second = await request(app).post(completePath);
  expect(first.body).toEqual(second.body);
  expect(first.body).not.toHaveProperty('email');
});

it.each([408, 429, 500])('returns a safe retryable response for %s-class failures', async () => {
  mockedComplete.mockRejectedValue(new RetryableDeliveryError('private storage detail'));
  const res = await request(app).post(completePath);
  expect(res.status).toBe(503);
  expect(res.body.error.message).toBe('Video delivery could not be finished yet.');
});
```

- [ ] **Step 5: Implement and mount the rate-limited router**

Reject unknown body keys. Map validation/conflict/expired/not-found/retryable
errors to `400/409/410/404/503`. Public responses contain only:

```ts
interface PublicDelivery {
  deliveryId: string;
  status: DeliveryStatus;
  downloadUrl: string;
  uploadUrl?: string;
  uploadHeaders?: Record<string, string>;
  retryable: boolean;
  error?: { message: string };
}
```

Mount `ejectorDeliveryApi` after `express.json()` in `index.ts`. Importing
`index.ts` in tests must never open AMQP or storage connections.

- [ ] **Step 6: Run API and full backend checks**

```bash
npm test -- --runInBand test/ejectorDeliveryService.test.ts \
  test/ejectorDeliveryApi.test.ts
npm test -- --runInBand
npm run typecheck
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit the delivery API**

```bash
git add index.ts src/ejectorDelivery/service.ts src/ejectorDelivery/api.ts \
  test/ejectorDeliveryService.test.ts test/ejectorDeliveryApi.test.ts
git commit -m "feat: expose ejector delivery workflow"
```

---

### Task 6: Consume email acceptance receipts and document payment-backend

**Repository:** `../payment-backend`

**Files:**
- Modify: `src/ejectorDelivery/mailQueue.ts`
- Create: `test/ejectorDeliveryReceipts.test.ts`
- Modify: `index.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `openapi.json`

**Interfaces:**
- Produces `startDeliveryReceiptConsumer(): Promise<void>`.
- Consumes Task 1's receipt JSON and calls `applyMailReceipt`.

- [ ] **Step 1: Write receipt and reconnect tests**

```ts
it('records acceptance before acknowledging the receipt', async () => {
  await onReceipt(message({
    deliveryId: UUID,
    status: 'accepted',
    attempts: 2,
    occurredAt: '2026-07-28T12:00:00Z',
  }));
  expect(mockApplyMailReceipt.mock.invocationCallOrder[0])
    .toBeLessThan(mockChannel.ack.mock.invocationCallOrder[0]);
});

it('records sanitized failure idempotently', async () => {
  await onReceipt(message({
    deliveryId: UUID,
    status: 'failed',
    attempts: 4,
    occurredAt: '2026-07-28T12:00:00Z',
    error: 'Email provider rejected the message.',
  }));
  expect(mockApplyMailReceipt).toHaveBeenCalledTimes(1);
  expect(mockChannel.ack).toHaveBeenCalled();
});

it('reconnects and resubscribes after connection close', async () => {
  await startDeliveryReceiptConsumer();
  firstConnection.emit('close');
  await flushReconnectTimer();
  expect(secondChannel.consume).toHaveBeenCalledWith(
    'EjectorDeliveryReceipts_dev',
    expect.any(Function),
  );
});
```

- [ ] **Step 2: Run receipt tests and verify red**

```bash
npm test -- --runInBand test/ejectorDeliveryReceipts.test.ts
```

Expected: FAIL because the consumer is absent.

- [ ] **Step 3: Implement the durable consumer**

Use one persistent AMQP connection, durable queue assertion, `prefetch(10)`,
schema validation, idempotent repository update, and acknowledgment only after
the database update. `nack(message, false, true)` transient database failures;
ack malformed messages after logging only their delivery ID when available.
Reconnect after 5 seconds without blocking the HTTP server.

Start the consumer only inside `if (require.main === module)`:

```ts
void startDeliveryReceiptConsumer().catch((error) => {
  console.error('Ejector receipt consumer startup failed', error);
});
```

- [ ] **Step 4: Synchronize configuration and API documentation**

Document every route request/response/error in `openapi.json`. Add all storage
and receipt variables to `.env.example` and README, the exact SQL migration
command expected by deployment, the mail-server-first rollout order, and the
fact that Mailgun acceptance—not inbox arrival—is the success boundary.
Add structured transition logs containing only delivery ID, payment ID,
status, attempts, and elapsed milliseconds; never log recipient email,
presigned URL, or public download URL. Document alerts for a sustained
receipt-queue backlog and elevated `failed` receipt counts.

- [ ] **Step 5: Run all payment-backend checks**

```bash
npm test -- --runInBand
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: PASS with no network access from tests.

- [ ] **Step 6: Commit receipt handling and docs**

```bash
git add index.ts src/ejectorDelivery/mailQueue.ts \
  test/ejectorDeliveryReceipts.test.ts .env.example README.md openapi.json
git commit -m "feat: confirm ejector email acceptance"
```

---

### Task 7: Build the browser delivery client

**Repository:** `ejector`

**Files:**
- Create: `src/lib/delivery/types.ts`
- Create: `src/lib/delivery/checksum.ts`
- Create: `src/lib/delivery/checksum.dom.test.ts`
- Create: `src/lib/delivery/retry.ts`
- Create: `src/lib/delivery/retry.test.ts`
- Create: `src/lib/delivery/client.ts`
- Create: `src/lib/delivery/client.dom.test.ts`
- Create: `src/lib/delivery/finishVideoDelivery.ts`
- Create: `src/lib/delivery/finishVideoDelivery.test.ts`

**Interfaces:**
- Produces `sha256Base64(blob): Promise<string>`.
- Produces `withRetry(operation, options): Promise<T>`.
- Produces `createDeliveryClient(baseUrl, paymentCode): DeliveryClient`.
- Produces `finishVideoDelivery(input): Promise<AcceptedDelivery>`.

Define the browser contract once in `types.ts`:

```ts
export type DeliveryStatus =
  | 'created' | 'uploaded' | 'email_pending' | 'email_accepted' | 'failed';

export interface DeliveryResponse {
  deliveryId: string;
  status: DeliveryStatus;
  downloadUrl: string;
  uploadUrl?: string;
  uploadHeaders?: Record<string, string>;
  retryable: boolean;
  error?: { message: string };
}

export type AcceptedDelivery = DeliveryResponse & { status: 'email_accepted' };

export interface DeliveryClient {
  initialize(input: InitializeDeliveryInput): Promise<DeliveryResponse>;
  upload(target: DeliveryResponse, blob: Blob): Promise<void>;
  complete(deliveryId: string): Promise<DeliveryResponse>;
  getStatus(deliveryId: string): Promise<DeliveryResponse>;
  retry(deliveryId: string): Promise<DeliveryResponse>;
}
```

- [ ] **Step 1: Write checksum and retry tests**

```ts
it('returns the base64 SHA-256 of the exact Blob bytes', async () => {
  await expect(sha256Base64(new Blob(['abc'], { type: 'video/mp4' })))
    .resolves.toBe('ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=');
});

it('uses one initial call plus 1s, 2s, and 4s retries', async () => {
  const operation = vi.fn()
    .mockRejectedValueOnce(new TypeError('network'))
    .mockRejectedValueOnce(new HttpDeliveryError(503, true))
    .mockRejectedValueOnce(new HttpDeliveryError(429, true))
    .mockResolvedValue('ok');
  const sleep = vi.fn().mockResolvedValue(undefined);
  await expect(withRetry(operation, { sleep })).resolves.toBe('ok');
  expect(operation).toHaveBeenCalledTimes(4);
  expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000, 4000]);
});
```

- [ ] **Step 2: Run unit tests and verify red**

```bash
npm test -- src/lib/delivery/checksum.dom.test.ts \
  src/lib/delivery/retry.test.ts
```

Expected: FAIL because the delivery utilities do not exist.

- [ ] **Step 3: Implement exact-byte checksum and retry classification**

`sha256Base64` uses `crypto.subtle.digest` over `blob.arrayBuffer()`. Retry only
`TypeError`, timeouts, `408`, `429`, and `5xx`; fail immediately for validation,
ownership, conflict, and expiration responses. Inject `sleep` in tests and use
`setTimeout` in production.

- [ ] **Step 4: Write MSW client contract tests**

```ts
it('never sends an email and uploads with the signed headers', async () => {
  server.use(
    http.post('http://payment-api.test/payment/ejector/code/deliveries',
      async ({ request }) => {
        const body = await request.json();
        expect(body).not.toHaveProperty('email');
        return HttpResponse.json(initialized);
      }),
    http.put('https://storage.test/upload', async ({ request }) => {
      expect(await request.arrayBuffer()).toEqual(await blob.arrayBuffer());
      expect(request.headers.get('x-amz-checksum-sha256')).toBe(CHECKSUM);
      return new HttpResponse(null, { status: 200 });
    }),
  );
  await client.initialize(input);
  await client.upload(initialized, blob);
});
```

- [ ] **Step 5: Implement the typed HTTP client and orchestrator**

`finishVideoDelivery` must:

```ts
const checksum = await sha256Base64(blob);
const initialized = await client.initialize({ deliveryId, tier, contentLength: blob.size, checksum });
let current = initialized;
if (current.status === 'failed') {
  current = await client.retry(deliveryId);
}
if (current.status === 'created' && current.uploadUrl) {
  await client.upload(current, blob);
}
if (current.status === 'created' || current.status === 'uploaded') {
  current = await client.complete(deliveryId);
}
while (current.status === 'email_pending' || current.status === 'uploaded') {
  current = await pollStatus(deliveryId);
}
if (current.status !== 'email_accepted') throw DeliveryError.from(current);
return current;
```

Bound polling by a configured 90-second deadline and a 1-second interval. A
lost response followed by a retry must consume the current backend status and
must not create a new UUID. Wrap initialize, upload, complete, status, and
retry requests in `withRetry`; polling intervals do not count as retry delays.

- [ ] **Step 6: Run delivery library and quality checks**

```bash
npm test -- src/lib/delivery
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit the browser delivery library**

```bash
git add src/lib/delivery
git commit -m "feat: add paid video delivery client"
```

---

### Task 8: Integrate delivery, generic finishing UI, and manual retry

**Repository:** `ejector`

**Files:**
- Modify: `src/hooks/useFileGeneration.ts`
- Modify: `src/hooks/useFileGeneration.test.tsx`
- Modify: `src/components/DownloadSection.tsx`
- Modify: `src/components/DownloadSection.test.tsx`
- Modify: `src/components/ErrorDialog.tsx`
- Modify: `src/components/ErrorDialog.test.tsx`
- Modify: `src/locales/en.json`
- Modify: `src/locales/pt-BR.json`

**Interfaces:**
- `useFileGeneration(paymentCode)` additionally returns
  `phase: "rendering" | "finishing" | null`,
  `canRetryDelivery: boolean`, and `retryDelivery(): Promise<void>`.
- `ErrorDialog` accepts optional `actionLabel` and `onAction`.

- [ ] **Step 1: Write hook tests proving render-once semantics**

```ts
it('waits for accepted email before downloading the paid MP4', async () => {
  finishVideoDelivery.mockResolvedValue({ status: 'email_accepted', downloadUrl: PUBLIC_URL });
  await act(() => result.current.generate('mp4', props, 'full-hd'));
  expect(renderEjectionVideo).toHaveBeenCalledTimes(1);
  expect(finishVideoDelivery).toHaveBeenCalledWith(expect.objectContaining({
    blob: renderedBlob,
    paymentCode: 'code',
    tier: 'full-hd',
  }));
  expect(finishVideoDelivery.mock.invocationCallOrder[0])
    .toBeLessThan(downloadBlob.mock.invocationCallOrder[0]);
});

it('manual retry reuses the Blob and UUID without rerendering', async () => {
  finishVideoDelivery
    .mockRejectedValueOnce(new DeliveryError('failed', true))
    .mockResolvedValueOnce(accepted);
  await act(() => result.current.generate('mp4', props, 'hd'));
  const firstId = finishVideoDelivery.mock.calls[0][0].deliveryId;
  await act(() => result.current.retryDelivery());
  expect(renderEjectionVideo).toHaveBeenCalledTimes(1);
  expect(finishVideoDelivery.mock.calls[1][0].deliveryId).toBe(firstId);
  expect(finishVideoDelivery.mock.calls[1][0].blob).toBe(renderedBlob);
});
```

- [ ] **Step 2: Run hook tests and verify red**

```bash
npm test -- src/hooks/useFileGeneration.test.tsx
```

Expected: FAIL because delivery is not integrated.

- [ ] **Step 3: Retain the pending render and gate download**

Add a ref containing `{ blob, filename, tier, paymentCode, deliveryId }`.
Generate the UUID after MP4 render succeeds, set phase to `finishing`, call
`finishVideoDelivery`, and call `downloadBlob` only after acceptance. Keep the
ref on a retryable failure; clear it on success or non-retryable failure. GIF
continues directly from render to download.

- [ ] **Step 4: Write component tests for generic copy and retry action**

```tsx
expect(screen.getByText('Your generation is being finished.')).toBeVisible();
expect(screen.queryByText(/uploading|emailing/i)).not.toBeInTheDocument();

await userEvent.click(screen.getByRole('button', { name: 'Retry delivery' }));
expect(retryDelivery).toHaveBeenCalledTimes(1);
```

Also test `ErrorDialog` closes only after the retry callback begins and remains
keyboard accessible.

- [ ] **Step 5: Implement the finishing UI**

Render:

```tsx
<span className="text-xs text-white/50">
  {t(phase === "finishing" ? "Your generation is being finished." : "Generating")}
</span>
```

Pass the payment context's `code` into `useFileGeneration`. Extend
`ErrorDialog` with a shadcn Button only when `canRetryDelivery` is true. Add
English and pt-BR translations for:

```text
Your generation is being finished.
We couldn't finish delivering your video.
Retry delivery
```

- [ ] **Step 6: Run hook, component, localization, and build checks**

```bash
npm test -- src/hooks/useFileGeneration.test.tsx \
  src/components/DownloadSection.test.tsx src/components/ErrorDialog.test.tsx
npm run typecheck
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit frontend integration**

```bash
git add src/hooks/useFileGeneration.ts src/hooks/useFileGeneration.test.tsx \
  src/components/DownloadSection.tsx src/components/DownloadSection.test.tsx \
  src/components/ErrorDialog.tsx src/components/ErrorDialog.test.tsx \
  src/locales/en.json src/locales/pt-BR.json
git commit -m "feat: finish paid videos through email delivery"
```

---

### Task 9: Add refresh recovery and frontend documentation

**Repository:** `ejector`

**Files:**
- Create: `src/lib/delivery/pendingDelivery.ts`
- Create: `src/lib/delivery/pendingDelivery.dom.test.ts`
- Create: `src/lib/delivery/downloadPublicUrl.ts`
- Create: `src/lib/delivery/downloadPublicUrl.dom.test.ts`
- Create: `src/components/DownloadSection.delivery.test.tsx`
- Modify: `src/hooks/useFileGeneration.ts`
- Modify: `src/hooks/useFileGeneration.test.tsx`
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces `savePendingDelivery`, `readPendingDelivery`, and
  `clearPendingDelivery` for one pending delivery in the current browser.
- Produces `downloadPublicUrl(url, filename)` for post-refresh completion.
- On reload, uploaded/email-pending deliveries resume polling; accepted
  deliveries download from their public URL; pre-upload records are cleared.

- [ ] **Step 1: Write local recovery tests**

```ts
it('stores no email, payment code, or Blob in the recovery record', () => {
  savePendingDelivery({
    deliveryId: UUID,
    tier: 'full-hd',
    filename: 'Red-was-ejected.mp4',
  });
  const raw = localStorage.getItem('ejector-pending-delivery');
  expect(raw).not.toContain('payment-code');
  expect(raw).not.toContain('paid@example.com');
  expect(raw).not.toContain('blob:');
});

it('resumes an email-pending delivery and downloads its public URL after acceptance', async () => {
  readPendingDelivery.mockReturnValue(pending);
  getStatus.mockResolvedValueOnce({ ...pending, status: 'email_pending' });
  pollStatus.mockResolvedValueOnce(accepted);
  renderHook(() => useFileGeneration('payment-code'));
  await waitFor(() => expect(downloadPublicUrl).toHaveBeenCalledWith(
    accepted.downloadUrl,
    pending.filename,
  ));
  expect(renderEjectionVideo).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run recovery tests and verify red**

```bash
npm test -- src/lib/delivery/pendingDelivery.dom.test.ts \
  src/lib/delivery/downloadPublicUrl.dom.test.ts \
  src/hooks/useFileGeneration.test.tsx \
  src/components/DownloadSection.delivery.test.tsx
```

Expected: FAIL because recovery storage is absent.

- [ ] **Step 3: Implement minimal local recovery**

Store one browser-local record containing only `deliveryId`, tier, and filename;
the payment code already lives separately under `ejector-payment-code`. Save
after UUID creation, clear after acceptance/non-retryable expiration, and never
store the Blob or email. On mount, query the backend with the current payment
code. Resume only server-confirmed `uploaded`, `email_pending`, or
`email_accepted` states. Clear a `404` record because it belongs to a different
or absent payment code. Implement `downloadPublicUrl` with a temporary
`<a href={url} download={filename} rel="noopener">`; storage's
`Content-Disposition: attachment` makes cross-origin links download reliably.

- [ ] **Step 4: Add a component-level delivery integration test**

Create `DownloadSection.delivery.test.tsx`. Use the sanctioned render-wrapper
mock through `renderEjectionVideo`, the real `useFileGeneration`, real delivery
client, `PaymentProvider`, and MSW handlers for initialize, storage PUT,
complete, and status. Record request order and assert:

```tsx
await waitFor(() =>
  expect(screen.getByText('Your generation is being finished.')).toBeVisible(),
);
await waitFor(() => expect(requestOrder).toEqual([
  'initialize', 'upload', 'complete', 'status',
]));
expect(downloadBlob).toHaveBeenCalledTimes(1);
```

This is the automated frontend end-to-end boundary test. Playwright keeps its
existing unpaid and paid-gate coverage because real WebCodecs export is not
reliable in headless Chromium.

- [ ] **Step 5: Correct privacy and architecture documentation**

Update README/CLAUDE so they no longer claim paid MP4 inputs are never stored.
State precisely: rendering remains 100% in-browser; paid MP4 output is uploaded
after rendering for persistent email delivery; free GIFs are not uploaded.
Document payment-backend route dependency and recovery behavior. No new public
frontend environment variable is required beyond
`NEXT_PUBLIC_PAYMENT_API_URL`.

- [ ] **Step 6: Run the complete Ejector suite**

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run e2e
git diff --check
```

Expected: all checks pass and the `src/lib` 80% line/branch gate remains green.

- [ ] **Step 7: Commit recovery and docs**

```bash
git add src/lib/delivery/pendingDelivery* src/lib/delivery/downloadPublicUrl* \
  src/hooks/useFileGeneration* \
  src/components/DownloadSection.delivery.test.tsx README.md CLAUDE.md
git commit -m "feat: recover pending ejector deliveries"
```

---

### Task 10: Cross-repository contract verification and rollout handoff

**Repositories:** `../mail-server`, `../payment-backend`, `ejector`

**Files:**
- Modify if verification exposes a mismatch: only files already named in Tasks 1–9.

**Interfaces:**
- The email queue envelope and receipt JSON must match byte-for-byte across the
  payment-backend producer, mail-server consumer, and payment-backend receipt
  consumer.
- The frontend public-delivery response type must match `openapi.json`.

- [ ] **Step 1: Compare the contracts mechanically**

Run:

```bash
rg -n "EjectorDeliveryReceipts|deliveryReceipt|email_accepted|h:Message-Id" \
  ../mail-server/packages ../mail-server/config \
  ../payment-backend/src ../payment-backend/openapi.json \
  src
```

Expected: queue names, statuses, receipt properties, and Message-ID spelling are
consistent. Fix any mismatch in its owning repository and rerun that
repository's focused tests.

- [ ] **Step 2: Run every repository's clean validation**

```bash
(cd ../mail-server && npm test -- --runInBand && npm run lint)
(cd ../payment-backend && npm run lint && npm run typecheck && npm test -- --runInBand && npm run build)
(npm run lint && npm run typecheck && npm test && npm run test:coverage && npm run build && npm run e2e)
```

Expected: every command exits zero.

- [ ] **Step 3: Perform a local integration smoke test**

With local PostgreSQL, S3-compatible storage, RabbitMQ, a stub Mailgun adapter,
payment-backend, and Ejector running:

```text
1. Seed one recent $3 Ejector payment and one discounted $5 Ejector payment.
2. Generate one HD and one Full HD MP4.
3. Observe one storage object and one accepted receipt per delivery UUID.
4. Repeat complete/status/retry requests and confirm no second queued email.
5. Open both public URLs and verify the MP4s persist.
6. Confirm local download begins only after the accepted receipt.
```

Expected: HD is 1280×720 with watermark; discounted Full HD is 1920×1080
without watermark; each payment email receives one link per generated video.

- [ ] **Step 4: Review migration and deployment readiness**

Confirm the production storage bucket denies list/write, permits object GET,
has the configured public base URL, and supports `ChecksumSHA256` on signed
PUT/HEAD. Its CORS policy must allow `PUT` from
`https://ejector.kassellabs.io` with `content-type`,
`content-length`, and `x-amz-checksum-sha256` request headers. Apply the
additive payment migration before starting the new payment backend. Deploy
mail-server first, wait for its consumer health, then payment-backend, verify
its receipt consumer, and finally deploy Ejector.

- [ ] **Step 5: Commit any verification-only corrections**

If Step 1–4 required edits:

```bash
(cd ../mail-server && git add packages/amqp package.json config README.md \
  && git commit -m "fix: align ejector delivery contracts")
(cd ../payment-backend && git add index.ts src/ejectorDelivery test \
  database-schema .env.example README.md openapi.json package.json package-lock.json \
  && git commit -m "fix: align ejector delivery contracts")
(git add src/lib/delivery src/hooks src/components src/locales README.md CLAUDE.md \
  && git commit -m "fix: align ejector delivery contracts")
```

Run only the command for a repository that actually has corrections. If no
edits were required, do not create an empty commit.

- [ ] **Step 6: Prepare pull requests**

Push one branch per changed repository and open PRs in dependency order:

```text
1. mail-server — tracked provider receipts
2. payment-backend — storage, delivery API, email producer/receipt consumer
3. ejector — browser upload, wait-for-acceptance, retry UI
```

Each PR description links the approved design, lists its migration/config
requirements, and includes the exact validation commands and results. Merge
only after required checks pass, preserving the same deployment order.
