# `lib/datasetOnboarding`

Boundary, interpretation, recovery and dataset-access layer for the Gateway
**workflow-process** onboarding contract (UI issue #333).

Consumers outside this directory:

| Consumer | Task | Owns |
|---|---|---|
| `src/hooks/useDatasetOnboardingProcess.ts` | 4.1 | Read cadence, cancellation, scope isolation |
| `src/hooks/useApi.ts` → `datasetOnboarding` | 4.3, 5.3 | The authenticated binding: session scope, the process adapter and the dataset reader over the shared transport |
| `src/hooks/useDatasetOnboardingRoute.ts` | 4.3 | Headless composition for `/datasets/onboarding/[processInstanceId]` |
| `src/components/DatasetOnboarding/` | 5.1, 5.2 | Rendering the `OnboardingView`; no state of its own |
| `src/hooks/useDatasetOnboardingAccess.ts` | 5.3 | The scoped availability lifecycle: when the dataset is read, for whom, and how often |
| `src/hooks/useDatasetOnboardingPage.ts` | 5.3 | Composition of the route controller, the availability hook and the pure view |
| `src/app/datasets/onboarding/[processInstanceId]/page.tsx` | 5.3 | The public page: shell, route parameter, initial focus, navigation |
| `src/hooks/useDatasetOnboardingSubmission.ts` | 6.1 | Submission lifecycle: the synchronous duplicate-start guard, the injected start operation, scope isolation, the one storage write |
| `src/components/DatasetOnboarding/OnboardingSessionProvider.tsx` | 6.1 | One shared submission owner, so an attempt survives a change of consumer. Not installed in the application |

The page exists and is the one user-facing path into all of this. It is
described under [The page and the availability reader](#the-page-and-the-availability-reader-task-53),
together with what its tests and browser evidence establish and what only a
live environment can.

## Modules and responsibilities

| File | Owns | Must not own |
|---|---|---|
| `types.ts` | The five distinct identifier roles, status/kind enums, wire DTOs, decoded domain shapes, start input, gateway outcomes, derived view model | React, HTTP, auth, layout |
| `decode.ts` | Boundary validation: shape, required identity, status, ordering. Returns a `DecodeResult`, never throws, never echoes backend text | What a status *means*, transport, interpretation |
| `gateway.ts` | `createOnboardingGateway(request)` — start/config/get over an **injected** transport, query projection, JSON decoding, failure classification | Timers, retries, caching, storage, grant policy, treating 2xx as publication |
| `access.ts` | `createDatasetAccessReader(request)` — one `GET /dataset/{id}?f=id&f=name` per operation over the same injected transport, single-object and identity validation, outcome classification (`readable`, `denied`, `auth-unusable`, `unavailable`, `unknown`, `cancelled`) | Timers, retries, the availability lifecycle, grant policy, inferring sharing or DMM readiness |
| `model.ts` | Pure configuration join, stage ordering, contradiction detection, notices and permitted actions from explicitly supplied access evidence | Fetching, hooks, storage, inferring access or readiness from an id |
| `recovery.ts` | One versioned same-tab session *reference*, its validation, and identity/environment matching over an injected storage-like boundary | Snapshots, titles, file data, group selections, tokens, any mutation, cross-tab history, an expiry policy |
| `submission.ts` | Retained-file validation, the frozen attempt, accepted/rejected/unknown transitions and the consumed-upload-reference ledger | Transport, retries, storage, grant or visibility policy, metadata re-validation, any claim about server staging |
| `form.ts` | One pure mapping from the add-dataset form's metadata fields onto the accepted start input, and the `DateOnly` publication date | Files and data locations (they belong with the validation in `submission.ts`), a second validator, a clock, sharing or collection fields |
| `fixtures/` | Synthetic payloads plus their provenance | Live captures, credentials, personal data |

Dependency direction is one-way: `types` ← `decode` ← `gateway` ← `access`,
and `types` ← `model`, `types` ← `recovery`, `types` ← `submission` ← `form`.
`gateway.ts` does not import `model.ts`; `access.ts` imports only the transport
type and field-query helper from `gateway.ts` plus `types.ts`; `recovery.ts`
and `submission.ts` import nothing but `types.ts`, and `form.ts` imports only
`submission.ts`. No module here imports
React, a hook, a component, the Next router or the auth client, so the whole
directory is testable without a DOM or a network.

The transport is injected with the same signature as the existing private
`makeRequest` in `src/hooks/useApi.ts` — `(path, RequestInit) => Promise<Response>`
— which already applies the bearer token and the `/gw/api` prefix. Paths here
are relative to `/gw/api` and must not repeat it. That seam is wired in
`useApi` — see [The authenticated binding](#the-authenticated-binding) — and
the direction stays one-way: no module in this directory imports `useApi`.

## Contract rules encoded here

These come from the batch 01 contract review and the architect's disposition.
They are **source-derived at a pinned Gateway revision and not live-verified**.

- **Status `0` is `InProgress`.** Every check is an explicit comparison; a
  truthiness test silently drops a running process.
- **Two separate kind enums.** Configuration *items* use `WorkflowProcessKind`
  (0–5); configuration *steps* use `WorkflowDefinitionKind` (0–10, where 6–10
  are the `_test` variants the checked-in configuration actually uses).
  Process-instance steps carry **no** kind field and join configuration by
  `stepId`. Treating a `_test` kind as unknown would misread a real config.
- **camelCase, repeated `f=` projection.** `id` and `status` are always
  requested alongside nested fields, so that a step-level censor degrades the
  response instead of censoring the entire field set into a 403.
- **A 2xx missing required identity or status is malformed monitoring** — not
  proof of denial, failure or completion. It is rejected so the caller can say
  "we could not read this" rather than invent a state.
- **Absent is not empty.** The Gateway omits null properties, so a missing
  `steps` key means "not projected or censored", never "no stages ran" and never
  "every stage succeeded". An empty array is a different, explicit fact.
- **Start never retries.** Only **400 and 401** are treated as definite
  rejections: at the pinned revision both are raised by action filters or
  middleware that run before the action body, so nothing can have been
  persisted. **403 is not in that set.** The start path authorizes
  `CanExecuteDatasetOnboarding` *before* persisting but `OnboardDataset` only
  *after*, and the checked-in defaults give those two permissions different
  roles — so a 403 can be returned for an attempt that already created a
  process. Whether the ambient transaction filter rolls that back cannot be
  determined from the pinned sources (the package is external and not
  vendored), so the source offers no guarantee either way and this module
  claims none. 403, 404/5xx, a lost response, an unreadable body and a 2xx
  without `id` are all *unknown* outcomes: never replayed, and their staging
  references never reused.
- **DMM readiness never overwrites process state**, and a dataset id alone
  establishes neither readability nor publication.

## What this module cannot establish

It is a contract *proposal* built from source at
`dg-app-api 8988a7e879a2239b85dcb4a7f4ce932e368674fd`. It does not establish
deployed behaviour. Specifically still open: runtime field-name casing and
binder parsing, whether a non-admin contributor can start or read a process at
all, where and when creator grants are assigned on the new path, the deployed
configuration's stage kinds and task ids, and whether a refused start actually
leaves a process row behind. Those are live checks owned outside this batch.
This module deliberately takes no position on that last one: it neither asserts
that rows survive nor that they are rolled back, and treats the outcome as
unknown precisely because the source settles neither.

The fake-transport tests in this directory prove the adapter issues one call
per operation. That is **not** the same as proving the shared transport is
replay-safe; that is proved separately over the real `fetchWithAuth`, in
`src/lib/utils.auth.test.ts` and `src/hooks/useApi.onboarding.test.tsx`.

## Monitoring lifecycle

`src/hooks/useDatasetOnboardingProcess.ts` (task 4.1) is the only thing that
decides *when* to read. It composes `gateway.ts` and `model.ts` and adds
nothing to their semantics.

**Scope is supplied, never derived.** The hook takes
`{ principalId, gatewayOrigin }` plus a `processInstanceId`. It does not decode
a bearer token, does not read a session and does not treat token text as an
identity. Until both identity halves and the process reference are present and
non-blank, it issues no request at all.

**Reads are injected.** The hook depends on an `OnboardingProcessReads`
interface — `getProcess` and `getConfig` only. `OnboardingGateway` satisfies it
structurally, so the real adapter can be passed without the hook importing it.
`start` is deliberately not part of that interface: the hook has no reachable
mutation.

Polling policy, from design decision 4:

| Situation | Behaviour |
|---|---|
| Mount with a resolved scope | One immediate read, plus one configuration read |
| After a completed read | 5 s delay, so reads never overlap |
| Consecutive transient/malformed failures | 10 s, 20 s, 30 s, then held at 30 s; reset by any success |
| Read failure with a previous snapshot | Snapshot retained as `stale`, never discarded |
| Tab hidden | Paused; no poll is scheduled even by a read completing while hidden |
| Tab visible again | One immediate read, then the ordinary cadence |
| Aggregate `Failed` or `Succeeded` | Stopped; "check again" still reads |
| 401 / 403 | Stopped as `forbidden`; a confirmed denial is not retried on a timer |
| 404 | Stopped as `unavailable`; this asserts no deletion |
| Unknown numeric status | **Not** terminal — polling continues |
| "Check again" during an in-flight read | Coalesces into it; no second concurrent request |
| "Check again" while stopped, read fails | Stop and stop reason **retained**; the new failure shows as `stale`/`unavailable`; still manually retryable; no timer is armed |

Only a **successful** read lifts a stop, and then polling resumes on the
ordinary cadence — so recovering access through "check again" does not require a
remount. A failed recheck of a stopped monitor deliberately keeps reporting
`stopped`: the alternative would tell a consumer that automatic checks are
running when `schedule()` has armed no timer and none will fire.

**Scope changes clear on the render that changes them**, not in a following
effect. An effect would paint one frame of the previous principal's process
first. Late responses are rejected by three independent guards — a per-effect
cancellation flag, a generation counter, and a scope comparison inside the
state update — so a transport that ignores its `AbortSignal` still cannot write
into a newer scope.

A refreshed transport for the same principal is **not** a scope change: the
operations object is read through a ref, so a token refresh neither restarts the
poller nor clears the screen, and the next scheduled read uses the new object.

Availability and sharing stay inputs. The hook performs no dataset-readability
probe — that is `useDatasetOnboardingAccess`, described under task 5.3 below —
and adds no access or sharing policy; it forwards the caller's `AccessEvidence`
to `model.ts` unchanged.

## Session recovery

`recovery.ts` (task 4.2) persists exactly one versioned reference:

```
{ version, processInstanceId, principalId, gatewayOrigin, recordedAt,
  sharingNeedsReconciliation }
```

Nothing else is stored — no snapshot, dataset title, file data, selected group
or token — and the record is reassembled field by field on both write and read,
so an extra property cannot smuggle itself through in either direction.

- **Storage is injected** (`SessionStorageLike`). `getBrowserSessionStorage()`
  resolves `window.sessionStorage` on call, returning `null` where it cannot be
  reached. Every access is wrapped: a blocked or quota-exhausted store yields an
  `unavailable` outcome and never throws, so in-memory monitoring is unaffected.
- **No identity, no record.** Reading and writing both refuse a blank principal
  or environment. A read with an unresolved identity does not even touch
  storage.
- **Invalid records are discarded** — unparsable, non-object, unknown version,
  or any invalid id/environment/timestamp/boolean field. "Discarded" means
  *logically refused*: the record is never parsed into a value and never
  returned. Removal from storage is a best-effort tidy-up so the entry is not
  re-examined on every read; a store that rejects the removal still yields
  `discarded`, and the outcome never promises that the underlying entry is
  gone. Nothing throws either way.
- **Foreign records are refused, not deleted.** A record belonging to another
  principal or environment is reported as `foreign` and never returned. It is
  left in place because this module cannot distinguish an account switch from a
  transient identity change; `clearSessionRecord` is the explicit sign-out path.
- **Restoring is not resuming.** A restored reference is a hint to read again
  through the Gateway, which is what enforces access. It cannot authorise a
  grant, a replay or a restart, and `sharingNeedsReconciliation` records that
  sharing still has to be re-established — never that it may be re-applied.

Scope is per tab: `sessionStorage` gives no cross-tab or cross-device recovery,
which is the agreed slice. No expiry policy is applied.

## The authenticated binding

`useApi()` exposes one memoised member, `datasetOnboarding` (tasks 4.3 and
5.3). It is the single seam between this library and the application's
authenticated client, and it carries no workflow logic, no storage and no
timers.

```ts
const { datasetOnboarding } = useApi();
// { auth, scope, gateway, readDataset }
```

`readDataset` (task 5.3) is created from the **same captured transport
closure** as `gateway`, so both share one bearer token, one `/gw/api` prefix,
one 401 policy and one refusal when no identity is resolved. It is additive:
no existing operation, default or exported type changed, and the binding still
exposes operations, never a token.

`useApi()` returns a **fresh containing object on every render**. Depend on
`datasetOnboarding`, never on the object holding it.

**Identity.** `scope` is non-null only when all four conditions hold: the
session is `authenticated`, an access token is present, no session error is
reported, and `session.user.id` is a non-empty string. Anything else yields a
null scope plus an explicit reason — `loading`, `unauthenticated`,
`session-error`, `credentials-unavailable` or `identity-unavailable` — which
the consumer needs, because "loading" is not "signed out". There is no fallback
to an email, a display name or claims decoded from the bearer token: those are
not stable application principals. The source basis is the installed Keycloak
provider (`profile.sub` → `user.id`), the JWT callback storing `token.user` and
the session callback re-exposing it; `src/types/next-auth.d.ts` types that as
**optional** and every consumer still checks it at runtime. This is a source
observation, not a runtime guarantee.

**Environment.** `gatewayOrigin` is the whole configured API base with trailing
slashes normalised — not `URL.origin`, because two deployments can differ only
by path. It is resolved once per mounted `useApi`, so an environment change is
necessarily a remount.

**Transport policy.** `fetchWithAuth` and the private `makeRequest` take an
optional third argument, `AuthRetryPolicy`. It is a *local* decision about what
to do with a 401 and is never serialised: not into fetch options, not into a
header, not into a body. Callers that omit it keep today's behaviour exactly.

| Bound operation | Policy | Effect on 401 |
|---|---|---|
| Onboarding `start` (and any future non-GET/HEAD) | `retryOn401: false` | The original 401 is returned. No `getSession`, no second request, no logout redirect — resubmission stays a decision the caller makes with the classified outcome in hand |
| Onboarding reads, including the dataset read behind `readDataset` | `expectedPrincipalId` | One ordinary refresh and retry, but only after the refreshed `session.user.id` is confirmed to equal the principal that began the read |
| Every existing caller | none | Unchanged: refresh, retry once, log out on refresh failure, unchanged token or a second 401 |

A refreshed token on its own does **not** establish that the same person is
signed in — signing in as somebody else also produces one. When the refreshed
principal is missing or different, the original 401 goes back to the caller:
the read is not retried with another account's credentials, and that account is
not logged out either. Re-authentication is then the caller's decision.

**Why a mutation is never replayed here.** Not because a 401 start might have
persisted something — the accepted mapping above treats 400 and 401 as
rejections raised before the action body runs. It is that the transport sees
only a status code, while the *adapter* is what separates a definite rejection
from an uncertain outcome (403, a lost response, an unreadable body), and only
the uncertain ones are dangerous to repeat. Refreshing and resending inside the
transport would take that classification away from the caller entirely, for
every mutation bound to this policy, including future ones.

**Cancellation, and what it does and does not guarantee.** Opting in honours
the `AbortSignal` at each await boundary: before the first request, after
`getSession()` resolves, and after the retried request settles. A cancelled
scoped operation rejects with `AbortError`, which the adapter classifies as
`cancelled`.

| Cancelled… | Guarantee |
|---|---|
| before the first request | nothing is sent at all |
| while `getSession()` is pending | no retry is sent, and no redirect |
| while the retry is in flight, or after it settles but before the continuation resumes | **the retry is not unsent** — it had already left. What is guaranteed is that the superseded operation has no further effect: it does not navigate the tab to `/logout`, and it does not hand a late response back |

So "cancelled" means *this operation stops affecting the application*, never
that the server was left untouched. The guards are deliberately opt-in, so no
existing caller's timing changes.

This is a narrow boundary, not a repair of authentication generally. Global
refresh coordination, grace periods, forced logout on an unchanged token,
permission-related 401s and the default replay of *existing* mutations are all
untouched and remain separate work. Existing grant helpers keep the default
policy until group 6 binds them deliberately.

## Route composition

`src/hooks/useDatasetOnboardingRoute.ts` (task 4.3) is the headless controller
for `/datasets/onboarding/[processInstanceId]`. It owns no JSX, no router
redirect, no start and no grant; it decides *which* scope and *which* process a
mounted view may monitor and returns state plus read-only actions.

**The URL is authoritative.** A single non-empty parameter without control
characters is a valid reference; there is no UUID-only rule, because the
adapter imposes none. The value arrives already decoded by Next and is passed
on verbatim — decoding it again would corrupt any id containing a literal `%`,
and the adapter re-encodes it for the request. A repeated or catch-all segment
is refused rather than having its first element picked.

**A stored reference never substitutes for the URL.** An invalid or missing
parameter yields `invalid-reference` and issues no request at all, even when a
record for this principal exists. Conversely, a direct known-id URL is monitored
with no stored record and with no store at all: recovery storage does not gate
reads.

**Recovery contributes one marker, nothing else.** A record is consulted only
when its principal, environment *and* process id all match; a foreign record is
refused and its contents are never exposed. The result is a single boolean,
`sharingNeedsReconciliation`, which means "sharing still has to be
re-established" — never that a grant was applied, and never permission to
replay one. Absent or unreadable records leave sharing unknown, and a store
that throws costs the marker, not the monitoring.

**The controller does not write.** It creates and overwrites nothing and
persists no server response; writing the accepted-start reference is submission
ownership in group 6. Its one storage mutation is a best-effort *removal* when
the session is explicitly `unauthenticated`. Loading and a temporary session
error are not a sign-out, and clearing on either would lose a running process
the user can still return to. This is cleanup by a mounted controller, not
proof that sign-out is covered application-wide — that belongs to group 6 and
final integration.

Every auth-unavailable state hides previous data and stops reads on the render
that changes scope, because the monitoring hook clears synchronously; the
marker is compared against the current scope key for the same reason.

## Fixtures

Every fixture is synthetic — see `fixtures/provenance.ts`. None was captured
from a live environment. Configuration identifiers, orders, kinds and task ids
are copied from the checked-in Gateway `workflow-process.json` so the enum
spaces under test match a real file. Normal fixtures follow the wire shape
(camelCase, optional properties omitted); `explicitNullsProcess` exists only as
a defensive robustness case and is explicitly not an observed response.

## Tests

```sh
pnpm exec vitest run --config vitest.unit.config.ts \
  src/lib/datasetOnboarding \
  src/hooks/useDatasetOnboardingProcess.test.tsx \
  src/lib/utils.auth.test.ts \
  src/hooks/useApi.onboarding.test.tsx \
  src/hooks/useDatasetOnboardingRoute.test.tsx
```

Note that `pnpm test` runs a different runner (`tsx --test`) and does **not**
execute these files.

Three layers, deliberately separated:

- **Fake transport** (`lib/datasetOnboarding`): decoding, classification and
  one call per operation.
- **Controlled lifecycle** (`useDatasetOnboardingProcess`): timers and deferred
  responses rather than sleeping; call counts and cleanup rather than source
  strings.
- **Real transport** (`utils.auth`, `useApi.onboarding`,
  `useDatasetOnboardingRoute`): only the session and `fetch` are mocked, so
  `makeRequest`, `fetchWithAuth` and the adapter all run. These are the tests
  that can say anything about actual request counts, headers and replay.

Because `window.location.href` is a non-configurable accessor in jsdom, the
logout redirect cannot be spied on. It does not need to be: the private
`forceLogoutResponse()` is the only navigating path and always *resolves* with
a newly constructed 401. So returning the *original* response object proves it
was never entered — and so does **rejecting** with `AbortError`, since a
rejection and that synthetic response are mutually exclusive outcomes of the
same return statement. That is how the cancellation cases assert "no logout".
It remains an argument about this module's single navigating path, not a proof
of browser navigation behaviour; the page's own navigation is observed in the
task 5.3 browser evidence below, and real sign-out behaviour remains group 7.

What none of these tests establishes: deployed Gateway behaviour, whether a
contributor can actually start or read a process, or that sign-out is handled
outside a mounted controller. Page, layout, focus and browser behaviour are
covered by the page tests and the browser evidence described under
[The page and the availability reader](#the-page-and-the-availability-reader-task-53),
not by the selection above.

## Continuous integration (task 6.6)

```sh
pnpm run test:onboarding
```

That script runs this feature's Vitest suite through `vitest.unit.config.ts`.
It selects by directory and prefix — `src/app/datasets/onboarding/`,
`src/app/datasets/add/`, `src/lib/datasetOnboarding/`,
`src/components/DatasetOnboarding/`, `src/components/AddDatasetForm/`,
`src/components/ui/datasets/Classification`, `src/hooks/useDatasetOnboarding*`
— plus `src/hooks/useApi.onboarding.test.tsx` and `src/lib/utils.auth.test.ts`,
so a new test file under those paths is picked up without editing the script.
It currently selects 22 files: the 17 of task 6.6 plus the five the form
integration added (`form.test.ts`,
`DatasetOnboardingSessionBoundary.test.tsx`, `AddDatasetForm.test.tsx`,
`app/datasets/add/page.test.tsx` and `Classification.test.tsx`). An empty
selection fails rather than passing: Vitest exits 1 when a filter matches no
test files.

The `Run dataset onboarding tests (Vitest)` step of the `quality` job in
`.github/workflows/ci.yml` runs that script, and a failing test fails the job.
The separate `tsx --test` step (`pnpm run test:coverage`) is unchanged and
still executes no Vitest suite.

This describes **configured** CI execution only. No hosted Actions run of the
step has been observed. The job requests Node 20.x, while the local validation
ran on Node 24.14.0: Vite 7.3.1 and jsdom 28.0.0 require `^20.19.0` within that
major and no such Node 20 build was installed locally, so Node 20 execution of
this selection is unverified. The workflow file itself is unchanged by the form
integration; only the script's selection grew.

## Presentation (task 5.1/5.2)

`components/DatasetOnboarding/` renders this module's `OnboardingView`. The
split is the point: the library decides *what is true*, the components decide
*how it reads*. They add no state machine of their own, and every status, stage
order and permitted action on screen came from `model.ts`.

- `ProcessingView.tsx` — heading, aggregate banner, stage panels, notices and
  the two read-only actions. It takes an `OnboardingView` plus plain props for
  read health (`phase`, `lastFailure`, `reference`, session availability) and
  the recovery marker, all supplied by the caller from the accepted controller.
- `StageList.tsx` — the stage rows. Configured stages render as an ordered
  list; steps with no configuration match render as an unordered one, so the
  markup itself cannot imply a sequence we have not confirmed.
- `presentation.ts` — stage labels, state wording, notice copy and the live
  announcement. Every `NoticeCode` has an entry, so adding one to the model
  without wording it is a type error.
- `fixtures.ts` — `OnboardingView` values built by running the real decoder and
  model over the synthetic payloads above. Development and test use only.

Running them:

```sh
pnpm exec vitest run --config vitest.unit.config.ts src/components/DatasetOnboarding
```

Stories are development-only previews of the same fixtures:

```sh
pnpm exec storybook dev --port 6006 --ci --no-open
```

**Storybook does not currently render in this workspace**, and not because of
this feature — no story does, including pre-existing ones. `globals.css`
imports `flowbite-react/plugin/tailwindcss`, which exposes CSS only under the
`style` export condition. Tailwind's own resolver honours that; the
`postcss-import` in Storybook's Vite CSS pipeline does not, loads the JS entry
instead and fails with `Unknown word import`. Next's build is unaffected.

What the components deliberately do **not** do: fetch, poll, store, own a timer
or a busy flag, derive availability or sharing from a status or an id, offer a
rerun, cancel, percentage or time estimate, or move focus on mount. Initial
heading focus after route navigation is done by the page (task 5.3, below);
the heading carries `tabIndex={-1}` only so that it is a valid focus target.

Stage text colours are chosen for measured legibility, not only for palette
membership: every `StageState` label and status was measured against its actual
painted background in a browser and clears the 4.5:1 that normal-size text
needs. The measurements, not the class names, are the evidence — see
`evidence/correction-01/contrast-results.json` in the batch record. A colour
that appears in the style guide is not automatically readable on every surface.

What this section does not establish: deployed behaviour, any claim about
dataset availability or sharing — those belong to the page and its availability
hook, below — or an accessibility pass beyond the specific text/background
ratios measured above. The page, route and shell are the next section.

## The page and the availability reader (task 5.3)

`app/datasets/onboarding/[processInstanceId]/page.tsx` is the public processing
page. It supplies only what the composition cannot: the shell, the route
parameter and navigation. It does not fetch, poll, decode, decide an action or
hold workflow state, and it is not gated on a submission rollout flag — a
process that already exists stays readable to an authorised user regardless of
whether new submissions are enabled.

The order of composition is the point. `useDatasetOnboardingPage` runs the
accepted route controller first, then reads dataset availability with the id
that controller reported, then derives the view with the **pure**
`buildOnboardingView`. Feeding access evidence into the controller instead
would be circular: the dataset id and the completion that make an availability
read meaningful are outputs of that very controller.

### What the reader reads, and what it may conclude

`access.ts` issues one `GET /dataset/{id}?f=id&f=name` per operation over the
same captured transport as the process adapter, so it inherits the feature's
principal-checked 401 policy rather than the generic default. A **single**
object whose `id` is the one requested is evidence of readable metadata for
that scope; `name` is optional and used only as a subtitle. A wrapper, an
array, a missing or mismatched id, an unreadable body or a cancelled response
never confirms anything. 403 is denied, 401 says the session is unusable, 404
says the reference did not resolve (never that anything was deleted), and
everything else stays unknown.

Readable metadata establishes **only** that: not any details subresource, not
download, not search, not sharing, not a DMM-ready state, and not a grant.
Sharing stays `not-confirmed` throughout 04B, and `dmmReady` is never inferred
from this read.

`useDatasetOnboardingAccess` owns the lifetime, and it keeps two kinds of read
apart. The **automatic** cycle starts only when the aggregate reports Succeeded
— an inconsistent display is not a completion — and then reads at most three
times, five seconds apart, stopping early on a readable, denied or
unusable-session answer, or on a malformed one. That budget is a **UI
politeness limit, not a service timing guarantee**. A **manual** read (`Check
again`) is allowed as soon as a dataset id is known, even while the process is
still running: it updates availability and the title, coalesces with a read
already in flight, never schedules a retry, and neither spends nor stops the
automatic budget. So the first completion observed for a scope still gets its
immediate automatic read and both retries, however many manual reads came
before it and whatever they were answered — including 403, 401 or a malformed
body. `attemptsUsed` and `automaticStopped` describe the automatic cycle only.
The two never overlap: a manual request during an automatic read joins it, and
an automatic read that falls due while a manual one holds the transport runs as
soon as that read settles. Identity, environment, process or dataset changes
clear the previous answer and
its title on the render that changes scope, abort the outstanding read and
reject any late body; a later failed read removes a previously confirmed
availability rather than leaving an action without evidence. Nothing is
persisted: the evidence is in memory and dies with the scope.

Navigation uses `router.push("/datasets/<encoded id>")`. Next applies the
configured `basePath` itself, so the path must not already carry one — see the
handback for the existing `getNavigationUrl` pattern that applies a second,
separately configured base path.

### Reproducing the checks

```sh
pnpm exec vitest run --config vitest.unit.config.ts \
  src/lib/datasetOnboarding/access.test.ts \
  src/hooks/useDatasetOnboardingAccess.test.tsx \
  src/hooks/useDatasetOnboardingPage.test.tsx \
  'src/app/datasets/onboarding/[processInstanceId]/page.test.tsx' \
  src/hooks/useApi.onboarding.test.tsx \
  src/hooks/useDatasetOnboardingRoute.test.tsx
```

Actual-page browser evidence runs against a local server you start yourself and
drives the real application — real providers, real shell, real CSS — with only
`/__env.js`, `/api/auth/*` and the Gateway origin intercepted:

```sh
pnpm exec next dev --hostname 127.0.0.1 --port 3117
node <batch>/evidence/browser-check.mjs --base http://127.0.0.1:3117
```

What none of this establishes: authentication, deployed permissions, real
uploader or group-member access, asynchronous Gateway processing, submission,
sharing, or an observed CI result — the Actions job is configured to run this
Vitest selection (see [Continuous integration](#continuous-integration-task-66)),
but no hosted run has been observed and it never runs the browser script.

## Submission ownership (task 6.1, offline subset)

`submission.ts` owns the deterministic half of "submit once": which retained
files may be submitted, what exactly is frozen into one attempt, how an attempt
settles, and which upload references may never be sent again. It is a leaf like
the rest of this directory — no React, no HTTP, no auth, no storage, no timers.

Two consumers complete the seam and live outside this directory:

| Consumer | Task | Owns |
|---|---|---|
| `src/hooks/useDatasetOnboardingSubmission.ts` | 6.1 | Lifecycle: the synchronous duplicate-start guard, the injected start operation, scope isolation, and the one storage write |
| `src/components/DatasetOnboarding/OnboardingSessionProvider.tsx` | 6.1 | One shared owner, so the attempt survives a change of consumer |

Dependency direction stays one-way: `types` ← `submission`, and the hook
composes `submission` with the accepted `recovery`. `submission.ts` imports
`types.ts` and nothing else — not the adapter, not `model.ts`, not `recovery.ts`
— so it cannot send, store or interpret anything.

### The three facts an attempt can end with

`accepted`, `rejected` and `unknown` come from the accepted adapter's
`StartOutcome` and stay distinct here. `rejected` is a definite pre-start
refusal (400/401 only); everything else the adapter could not guarantee —
including 403 and an unreadable 2xx — is `unknown`. An unknown attempt keeps no
process identity, is never retried automatically, and never adopts an id from
the store or from a dataset search.

### Upload references

Every reference this owner sends enters a ledger and can only become *less*
restricted, never through time, a discard or a later process failure:

| Disposition | Set when | Reuse |
|---|---|---|
| `possibly-consumed` | The start is dispatched, and after an unknown outcome | Refused |
| `consumed` | The start was accepted | Refused |
| `unvalidated` | A definite rejection returned them unconsumed | Refused until evidence |

`unvalidated` is deliberately not "reusable": a refused request proves nothing
about whether the staged upload is still valid and still there. Lifting it
requires `StagingValidityEvidence`, which is an **input** — no Gateway call is
fabricated here and nothing infers renewed validity from a status code or
elapsed time. No evidence revives a `consumed` or `possibly-consumed`
reference.

### Retained files

Per the 23 September architect ruling (D7): at least one retained file, and
every retained file must have finished uploading with a usable reference. A
file that is still uploading, failed, carries no reference, carries an
unsendable one, or duplicates another file's reference **blocks** the
submission and is named in the refusal. Nothing is silently excluded — which is
what this replaces. It is UI submission integrity only: it establishes neither
server-side staging validity, staging lifetime, deduplication, nor
domain-specific multi-file completeness.

Each retained file becomes one `kind: File` data location, in file order, with
the reference verbatim. `stagedPath` is **not** `DataLocationKind.Staged`: that
kind is the Gateway's single-directory contract, which `OnboardValidator`
requires to be the only location in a request. The existing uploader produces
one reference per file, so N file locations is what is preserved.

Metadata is frozen but not re-validated here. `OnboardValidator` is the
authority on a well-formed start, and a second frontend copy of its rules would
drift; a refusal it issues is a definite rejection, which this module models.

### What the hook adds

- **The guard is synchronous.** `submit` validates, freezes and marks the
  attempt in flight before anything is awaited, so repeated actions in one tick
  are refused rather than dispatched. This is per-owner UI deduplication; it is
  not a claim about server idempotency, another tab, or a later deliberate
  submission.
- **Start is reachable only from `submit`.** No mount, effect, refresh, timer
  or retry can reach the operation.
- **Actions belong to the owner that issued them.** `submit`, `discard`,
  `abort`, the validity injection and the ledger accessor are re-created per
  owner and reject a handle kept past a teardown or an identity/environment
  change — before reading, dispatching or mutating anything. Returning to an
  earlier principal creates a new owner, so an old handle never revives. A
  handle kept across ordinary re-renders, including a same-principal token
  refresh, stays usable.
- **A refusal is never the attempt's state.** Refusing one submission records
  why, and leaves an accepted process reference, an unknown outcome, a running
  attempt or a definite rejection exactly where it was. Only an explicit
  discard permits another attempt.
- **Scope is `{ principalId, gatewayOrigin }`, supplied.** No token text, no
  email. State is cleared on the render that changes scope, and a generation
  counter bumped there and on teardown rejects a late result even from a
  transport that ignored its abort signal — so neither a render nor a storage
  write leaks into the next scope. A same-principal token refresh hands the hook
  a new operations object, which is not a scope change and neither restarts a
  submission nor discards a pending attempt.
- **Abort signals the transport only.** A start the server already received is
  not undone, which is why that attempt's references stay unusable and an
  accepted response arriving after an abort still keeps its process identity.
- **One storage write, never a read.** On acceptance the hook reuses
  `writeSessionRecord` to store the existing minimal record with sharing
  unconfirmed. A failing store costs a notice, not the accepted reference. The
  store is never consulted here, so no stored id can be borrowed by an unknown
  start and nothing can drive a resubmission.

### Sharing intent

Onboarding requests **no sharing at all**. Every submission the migrated form
makes carries `sharing: null`, which is a statement about our requests and
nothing else: it is not a fabricated `Restricted` selection, and it establishes
neither public nor restricted access.

A non-null intent is still accepted and carried verbatim, frozen and **in
memory**, for an explicitly evidenced earlier context. Nothing applies it: this
module reads no roles or permissions, assigns no collection and issues no
grant. The stored record carries only the reconciliation marker — never the
intent, the metadata, the references or a token.

### Reproducing the submission checks

```sh
pnpm exec vitest run --config vitest.unit.config.ts \
  src/lib/datasetOnboarding/submission.test.ts \
  src/lib/datasetOnboarding/form.test.ts \
  src/hooks/useDatasetOnboardingSubmission.test.tsx \
  src/components/DatasetOnboarding/OnboardingSessionProvider.test.tsx \
  src/components/DatasetOnboarding/DatasetOnboardingSessionBoundary.test.tsx \
  src/components/AddDatasetForm/AddDatasetForm.test.tsx
```

These run locally. The Actions job is also configured to run them, through
`pnpm run test:onboarding`; see
[Continuous integration](#continuous-integration-task-66). No hosted run of
that step has been observed.

## Private onboarding and the migrated form (tasks 6.1–6.5)

A new dataset is created **privately**. The form collects files and metadata,
starts one managed process and navigates to that process. Sharing and
collection assignment are separate, later actions that this flow does not
perform and does not promise.

### Where the owner lives

`app/datasets/layout.tsx` wraps `/datasets/*` in
`components/DatasetOnboarding/DatasetOnboardingSessionBoundary.tsx`, the client
seam that reads `useApi().datasetOnboarding.scope` and `.gateway` and hands
them to the accepted `OnboardingSessionProvider`. The boundary renders its
children and nothing else — no shell, no wrapper element.

It deliberately carries **no `key`**. Keying the provider by token, flag or
route would remount it and destroy the owner mid-attempt: a same-principal
token refresh would discard a pending start, and navigating add → processing
would lose the accepted process reference and the reference ledger. The
accepted hook already isolates by `{ principalId, gatewayOrigin }`, clearing
state on the render that changes scope.

Mounting the boundary performs **no request**. The processing route stays
independent of it and of the submission flags: a process that already exists
remains readable by an authorised user whatever the rollout switch says.

### What the form does and no longer does

| Removed | Replaced by |
|---|---|
| `Next` → sharing step → `Publish` | One deliberate `Start processing` action |
| Public/Restricted and recipient-group selection | Nothing. New datasets are created privately; `sharing: null` |
| Collection selector | Nothing. `Classification` takes `showCollection={false}`; the prop defaults to `true` for every other consumer |
| `onboardDataset` + group grants + delayed `profileDataset` + title-based dataset resolution | One `POST /workflow-process/onboard?f=id` through the accepted adapter |
| Unconditional "published successfully" modal | The actual outcome: accepted, a definite refusal, or an explicit uncertainty |

Validation, the uploader and every field are unchanged. An edit URL
(`?datasetId=…`) still refuses: it never creates a replacement dataset, the
submit control is disabled and the handler refuses before anything else is
considered. Every retained file is passed to the accepted validation — nothing
is silently excluded, which is what the old `stagedFiles.filter(...)` did — and
the separate `blocked` refusal is rendered without replacing the attempt's
status.

An accepted start navigates once to `/datasets/onboarding/<encoded id>` using a
bare Next route, matching the accepted monitoring page. If that navigation
fails the accepted process is retained and offered again; navigating again is
never another start. An uncertain outcome stays in the form with Browse
assistance and no automatic replay.

### Rollout flag

`datasetOnboardingMonitoring` is added to the existing flag mechanism with
**defaults false in every environment**. A new submission requires it *and* the
existing `datasetOnboarding` availability flag, and only once the overrides
have hydrated. Either one off disables starting a dataset — the button is
disabled *and* the handler refuses — and there is no legacy creation path
behind the refusal. Switching a flag off does not cancel or undo a start the
server has already received. A client flag is a rollout mechanism, not a
security control.

### Consumed files and recovery limits

Deduplication holds within **one mounted owner**. A remount is a new owner with
an empty ledger; no cross-tab, cross-refresh or server-side claim is implied. A
reference an accepted or uncertain start sent is never reusable; a definite
rejection leaves its references `unvalidated`, which means the files must be
uploaded again, not that they are known to be gone.

An accepted private start writes the existing minimal session record with
`sharingNeedsReconciliation: false` — nothing was requested, so nothing is
outstanding. The schema and its version are unchanged. An older record written
with `true` keeps its warning verbatim and is never rewritten: that request was
real and its outcome is still unknown. The processing page therefore supplies
`sharing: "not-requested"` unless a matching earlier record says otherwise, and
`not-requested` raises no notice at all. None of this is access evidence: the
absence of a warning says only that this flow issued no grant.

### What this still does not establish

No live Gateway call, credential or persistent flag override is involved
anywhere in the above. Creator rights, default uploader/admin-only visibility
and starter/config/process/step access in a target environment (G2) remain
unverified, as does whether later collection placement satisfies the intended
pilot (G3). Later sharing and collection management belong to the separate
permission-management work; the current settings editor is not established as
usable by an ordinary uploader. The live journeys (7.1/7.2) and final
acceptance (7.3) are separate tasks.
