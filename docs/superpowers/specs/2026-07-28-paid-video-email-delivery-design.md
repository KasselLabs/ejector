# Paid Video Email Delivery

**Date:** 2026-07-28
**Status:** Approved

## Goal

Every paid Ejector MP4 generation must:

1. upload the exact browser-rendered MP4 to persistent object storage;
2. email an unguessable, non-expiring public download link to the email address
   recorded on the payment;
3. send one email for that generated video, even when the browser retries a
   request; and
4. start the local browser download only after the email provider has accepted
   the message.

This applies to both paid tiers: watermarked 720p HD and clean 1080p Full HD.
Each new MP4 generation in the existing 24-hour paid window creates a new
delivery and sends one new email. Free GIF exports are unchanged and are not
uploaded or emailed.

## Agreed product behavior

| Topic | Decision |
|---|---|
| Stored file | Upload the exact MP4 Blob produced by the current browser renderer; never re-render it on a server |
| Link lifetime | Persistent, public, and non-expiring |
| Link secrecy | Unguessable object token; no payment code, email, or database ID in the URL |
| Recipient | Always the email on the successful payment row; the browser cannot supply or override it |
| Frequency | One email per newly generated paid video |
| Idempotency | All retries for one generation reuse one delivery UUID and cannot intentionally enqueue another email |
| Completion point | Mailgun has accepted the message, not merely RabbitMQ |
| UI copy | Keep the user-facing status generic: the generation is being finished |
| Retry | One initial attempt plus three automatic retries with short exponential backoff, followed by a shadcn retry dialog |
| Local download | Starts only after provider acceptance is recorded |

Mailgun acceptance is the synchronous success boundary. Final arrival at a
recipient's inbox is controlled by the receiving mail server and may occur
later; existing Mailgun event monitoring and fallback handling remain
responsible for later bounces or delivery failures.

## Scope and service ownership

The work spans three sibling repositories but does not introduce a new
service:

### `ejector`

- generates and retains the MP4 Blob;
- creates one stable delivery UUID per render;
- coordinates initialization, direct upload, finalization, and status polling;
- retries transient failures without re-rendering; and
- downloads the Blob locally only after email acceptance.

### `payment-backend`

- remains the source of truth for payment validity, entitlement, and recipient;
- owns the Ejector delivery record and state machine;
- issues constrained presigned object-storage uploads;
- verifies uploaded objects;
- renders the Ejector-ready HTML and plain-text email;
- publishes the email through the existing transactional queue; and
- consumes provider-acceptance receipts from the mail server.

### `mail-server`

- continues to be the only component that submits queued transactional email
  to Mailgun;
- retries tracked Ejector submissions up to three times;
- publishes a durable success or failure receipt after the Mailgun request;
- acknowledges the email queue message only after its receipt has been
  published; and
- leaves existing untracked email message behavior compatible.

Ejector does not join `intros-database`'s server-rendering request model. Its
email will use the same Kassel Labs visual language and transactional queue,
but the payment backend owns this client-rendered delivery lifecycle.

## Architecture

```text
Ejector browser
    │
    │ initialize(payment code, delivery UUID, tier, file metadata)
    ▼
payment-backend ───── presigned PUT ─────► object storage
    ▲                                           ▲
    │                                           │ exact MP4 Blob
    │ complete / poll                           │
    │                                           │
    └──── delivery status ◄── receipt queue ◄── mail-server ◄── Mails queue
                                                        │
                                                        ▼
                                                     Mailgun
```

The browser sends the existing payment code as its bearer entitlement. The
payment backend finds the newest Ejector payment inside the 24-hour window and
derives the recipient and paid tier from that row. Delivery endpoints receive
no email field.

For coupon purchases, entitlement is based on the pre-discount product price:

```text
entitlement dollars = payment.dollar_value + payment.discount_amount / 100
```

`discount_amount` is stored in cents. This prevents a discounted Full HD
purchase from being downgraded to HD while still keeping the actual charged
amount for accounting. The requested tier must not exceed that entitlement.

## Delivery record

Add an `ejector_delivery` table to the payment database. Its conceptual fields
are:

| Field | Purpose |
|---|---|
| `id` | Browser-generated UUID; primary idempotency key for one render |
| `payment_id` | Payment row used to authorize the delivery |
| `email` | Snapshot copied from the payment row, never client supplied |
| `tier` | `hd` or `full-hd` |
| `object_key` | Immutable object path containing a server-generated random token |
| `download_url` | Final persistent public URL |
| `expected_bytes` | Expected MP4 size |
| `checksum` | Base64 SHA-256 supplied by the browser and required by the upload |
| `status` | Current state |
| `mail_attempts` | Provider-submission attempts |
| `mail_message_id` | Stable RFC Message-ID derived from the delivery ID |
| `failed_stage` | Nullable stage used to resume the first incomplete operation |
| `last_error` | Sanitized last delivery error |
| `completion_expires_at` | Deadline for finishing or retrying this initialized delivery |
| timestamps | Created, uploaded, queued, accepted, failed, and updated times |

The delivery ID, object key, and mail message ID are unique. Creating the same
delivery ID again returns the existing record only when the payment code and
immutable file metadata match. Reusing it with conflicting values is a
conflict, not a new delivery.

The status state machine is:

```text
created → uploaded → email_pending → email_accepted
   │          │              │
   └──────────┴──────────────► failed
```

An error records the failed stage without discarding completed stages. An
uploaded object is never uploaded again solely because email submission
failed.

## HTTP contract

These routes extend payment-backend's existing payment REST API. This service
already exposes payment and webhook operations through REST and is not a
Strapi data API.

### Initialize

`POST /payment/ejector/:code/deliveries`

Request:

```json
{
  "deliveryId": "UUID",
  "tier": "full-hd",
  "contentType": "video/mp4",
  "contentLength": 12345678,
  "checksum": "base64-sha256"
}
```

The route rate-limits by IP and payment code, validates an active payment and
tier entitlement, upserts the delivery, and returns:

```json
{
  "deliveryId": "UUID",
  "status": "created",
  "uploadUrl": "short-lived-presigned-url",
  "uploadHeaders": {
    "content-type": "video/mp4",
    "x-amz-checksum-sha256": "base64-sha256"
  },
  "downloadUrl": "persistent-public-url"
}
```

`uploadUrl` is omitted when the verified upload already exists. Presigned
uploads expire after a short window and constrain object key, MIME type,
checksum, and configured maximum file size.

### Finalize

`POST /payment/ejector/:code/deliveries/:deliveryId/complete`

The backend checks the stored object's size, MIME type, and checksum before
moving it to `uploaded` and queuing email. Repeated calls are no-ops once email
is pending or accepted. The response returns the current status; it does not
wait on a single long-lived HTTP connection for Mailgun.

### Status

`GET /payment/ejector/:code/deliveries/:deliveryId`

Returns only the delivery ID, public download URL, status, retryability, and a
safe user-facing error. It never returns the payment email or storage
credentials.

### Retry

`POST /payment/ejector/:code/deliveries/:deliveryId/retry`

Retries the first incomplete stage. It returns the same object and email
identity. If the provider has already accepted the email, it returns
`email_accepted` without publishing another message.

Initialization requires the newest Ejector payment to be inside its active
24-hour window. The other routes require the payment code to match the payment
that authorized the delivery, and allow that already-initialized delivery to
finish for 24 hours after its creation. This prevents a render started near the
end of the paid window from becoming stuck while preventing indefinite new
uploads or retries.

## Storage

Use the existing AWS-compatible object storage. The payment backend receives
server-only storage credentials and a public asset base URL. The object path
has the form:

```text
ejector/videos/<server-random-token>.mp4
```

The token has at least 128 bits of entropy. The bucket denies listing and
anonymous writes but permits public reads for these objects. The uploaded
object is immutable and carries `video/mp4` plus attachment-oriented content
disposition metadata.

The browser uploads directly to storage so the payment backend never buffers
large MP4 files. The backend performs a `HEAD` verification before queuing
email. Size limits and a short presign lifetime limit abuse if a payment code
is exposed.

## Email submission and receipts

The payment backend renders an Ejector-specific HTML/text template and
publishes the existing `type: "email"` shape with additional optional tracking
metadata:

```json
{
  "type": "email",
  "payload": {
    "to": "payment-row-email",
    "subject": "Your Ejector video is ready",
    "html": "...",
    "text": "...",
    "h:Message-Id": "<ejector-delivery-UUID@kassellabs.io>"
  },
  "deliveryReceipt": {
    "deliveryId": "UUID",
    "queue": "EjectorDeliveryReceipts"
  }
}
```

Production and development queue suffixing follows the repositories' existing
mail queue conventions.

The email contains:

- a “Download your video” button directly to the persistent MP4;
- the full URL as a fallback;
- no expiry claim; and
- no payment or storage internals.

For tracked messages, mail-server makes one initial Mailgun submission plus up
to three retries with short exponential backoff. After Mailgun accepts, it
publishes a durable `accepted` receipt using a confirm channel, then
acknowledges the original mail message. After the final failure, it publishes a
durable `failed` receipt with a sanitized reason and then acknowledges the
original. The payment backend's receipt consumer updates the matching delivery
idempotently.

The stable delivery ID, state transitions, and Message-ID prevent normal
browser, API, and queue retries from producing additional intentional sends.
As with any external email API that lacks a request idempotency key, there is a
small unavoidable ambiguity if a process dies after Mailgun accepts the email
but before the durable receipt is published. Reusing the deterministic
Message-ID gives receiving systems a consistent duplicate identifier and
minimizes that edge case.

## Frontend behavior

The paid MP4 flow becomes:

1. Render the MP4 Blob once.
2. Generate and retain one delivery UUID for that render.
3. Calculate the Blob's SHA-256 checksum.
4. Initialize delivery.
5. Upload the exact Blob to the returned presigned URL.
6. Finalize delivery.
7. Poll until `email_accepted`.
8. Start the existing local Blob download.

The rendered Blob and delivery UUID remain in component state while the page
is open. Automatic retries and the manual retry action reuse both. When the
server reports that upload already succeeded, the client skips PUT; when it
reports acceptance, the client skips all email work.

User-facing progress must not mention uploading or emailing. During steps 3–7
it says the generation is being finished. If all automatic retries are
exhausted, the existing shadcn error dialog explains that finishing failed and
offers **Retry delivery**. No `window.alert`, `window.confirm`, or
`window.prompt` is introduced.

A refresh after the upload can recover by polling the retained delivery ID if
it is stored locally. A refresh before upload completion loses the in-memory
Blob and therefore requires another browser render; the backend still does not
send email for the incomplete delivery.

## Retry rules

- Client network operations: one initial attempt plus at most three retries
  after approximately 1 s, 2 s, and 4 s delays, limited to network errors,
  timeouts, `408`, `429`, and `5xx`.
- Validation, entitlement, and conflict responses are not automatically
  retried.
- Mailgun submission: one initial attempt plus at most three retries after
  approximately 1 s, 2 s, and 4 s inside the tracked mail consumer.
- Status polling uses a bounded interval and timeout; it does not create new
  delivery records.
- Manual retry resumes the current delivery. It never generates a replacement
  UUID and never re-renders while the Blob is available.

## Security and privacy

- The payment code remains the existing bearer entitlement. Initialization
  enforces the paid window; subsequent operations enforce the delivery's
  separate 24-hour completion deadline.
- The backend authorizes requested tiers using the pre-discount product price.
- Recipient email is selected server-side and is absent from public responses.
- Object URLs contain no personal or payment data and are infeasible to guess.
- Presigned URLs expire quickly and constrain upload properties.
- Object listing and anonymous upload remain disabled.
- API and storage errors exposed to the client are sanitized.
- Logs use delivery IDs and payment IDs, not full public URLs or recipient
  addresses.
- Delivery endpoints are rate-limited and enforce a configured MP4 size cap.

## Testing

### `ejector`

- Unit-test checksum generation, retry classification/backoff, response
  validation, polling, and recovery of an existing delivery.
- Component-test the paid flow: render once, upload exact Blob, wait for
  acceptance, then download.
- Assert that upload/finalize retries reuse the delivery ID and Blob.
- Assert that already-uploaded and already-accepted responses skip completed
  work.
- Assert that the progress copy never exposes upload/email implementation
  details.
- Assert that exhausted retries show a shadcn retry dialog and do not rerender.
- Cover both HD and discounted Full HD entitlements.

### `payment-backend`

- Repository/state-machine tests for idempotent create, complete, receipt, and
  retry transitions.
- API tests for active/expired/missing payments, ownership, conflicting
  idempotency payloads, rate limits, file constraints, and sanitized responses.
- Entitlement regression tests reconstruct the pre-discount tier for Stripe,
  PayPal, and fully discounted coupon payments.
- Storage tests mock presign and `HEAD`, including size, MIME, and checksum
  mismatch.
- Mail tests assert the recipient comes only from the payment row and that
  duplicate complete/retry calls publish once.
- Receipt-consumer tests cover accepted, failed, duplicate, and out-of-order
  receipts plus reconnect behavior.
- Keep `openapi.json`, `.env.example`, README, and architecture documentation
  synchronized.

### `mail-server`

- Test tracked-message success, stable Message-ID forwarding, and success
  receipt publication before acknowledgment.
- Test the initial provider attempt, three retries, and failure receipt
  publication.
- Test redelivery and duplicate receipt handling.
- Regression-test existing untracked `email` and legacy `template` messages.
- Verify broker reconnect behavior and publisher confirms for receipts.

### Integration verification

- Use local/mocked S3, RabbitMQ, and Mailgun boundaries for automated
  end-to-end coverage.
- Manually render one HD and one Full HD video in a supported browser, verify
  the uploaded object's resolution/watermark state, follow the emailed link,
  and confirm the browser download begins only after provider acceptance.
- Run each repository's lint, typecheck, tests, and build before committing.

## Documentation and configuration

Implementation updates:

- Ejector README architecture and paid-download behavior.
- payment-backend README, `openapi.json`, database schema/migration,
  `.env.example`, and relevant architecture instructions.
- mail-server README message contract and configuration examples.

New payment-backend configuration covers storage endpoint, region, bucket,
credentials, public asset base URL, upload expiry, maximum video bytes, and
the mail receipt queue. All credentials remain server-only and no `.env` file
is committed.

## Out of scope

- Server-side video rendering or transcoding.
- Emailing free GIF exports.
- Expiring or authenticated download URLs.
- A download-management page or customer account.
- User-entered recipient addresses.
- Inbox-level synchronous delivery confirmation.
- Migrating other intro creators to this delivery table.
- Refactoring the broader payment or rendering architecture.

## Rollout and observability

Deploy storage and mail-server receipt support before enabling the frontend
flow. Deploy payment-backend schema and APIs next, then Ejector last.

Track counts and latency for initialized, uploaded, email-pending, accepted,
and failed deliveries. Alert on sustained receipt-queue backlog or elevated
provider failures. The feature should be enabled only when storage, the email
queue, and the receipt consumer are healthy; otherwise the frontend surfaces
the retryable finishing error rather than claiming completion.
