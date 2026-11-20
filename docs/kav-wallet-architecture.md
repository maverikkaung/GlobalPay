# KAV Wallet and USDT Sandbox Architecture

**Status: simulation-only implementation prepared; staging activation is pending final isolated CI, backup, target, and dry-run checks.** TechKarvo does not accept, custody, exchange, or transfer real money or crypto. Migration `202611150013_simulated_financial_memberships.sql` prepares authenticated sandbox RPCs, the exact role-specific sample plans, usage and feature entitlements, an immutable balanced two-decimal KAV journal, simulated funding/withdrawal entries, explicit-consent renewals, milestone fee snapshots, refunds/disputes, and separate non-withdrawable reward credits. Demo Mode remains local-only and isolated. Both use the fixed reference `1 USDT = 1 KAV` only as a labeled simulation rule. It is not a market price, reserve claim, redemption promise, or live conversion rate.

## $0 build boundary

- Keep the persistent sandbox ledger disabled in any hosted environment until the database owner approves and applies the reviewed staging migration. A buyer must review the SQL, CI results, RLS, triggers, and RPC behavior before applying it to a buyer-owned project.
- The sandbox journal is fictional product testing data, not accounting evidence, customer balances, deposits, payouts, or legally meaningful escrow. Every API response and UI action must retain the simulation warning.
- Use two-decimal sample amounts and a conspicuous `SIMULATED — NO FUNDS MOVED` label. Never use wallet addresses, real provider credentials, or outbound payment requests in the demo.
- Do not add cryptocurrency signing, custody, exchange, production webhooks, real payout paths, or a user-editable balance in Supabase.
- A buyer may connect a sandbox provider after choosing a provider and setting up a separate sandbox project. No external service is required to build or test the current product.

## Future service boundaries

- Keep marketplace identity/contracts separate from financial custody and payment processing.
- A future wallet requires a trusted server-side ledger API, provider adapter, reconciliation workers, immutable audit events, incident response and explicit operational controls.
- Browser clients must never receive provider secrets, signing keys, privileged database credentials, or permission to write ledger entries directly.
- Contract status alone must never imply payment, escrow, or funds availability.

## Double-entry ledger requirements

- Use append-only journal entries. Every posted transaction has at least two lines, all in one currency, whose signed amounts sum to zero.
- Use decimal minor-unit precision for sample KAV amounts and explicit asset/currency identifiers. Treat the demo conversion of `1 USDT = 1 KAV` as a simulation constant, never as a hard-coded live peg.
- Separate accounts by owner and purpose: platform clearing, user available, user held, funding pending, provider payable, refund payable, withdrawal pending, fees, and loss/dispute reserve.
- Enforce unique idempotency keys and external provider references. Posted entries cannot be edited/deleted; corrections use linked reversing entries with actor, reason, original transaction ID, and timestamp.
- Enforce ownership, currency, state transitions, balanced journals, and idempotency in trusted server/database logic. Reconcile account and global totals continuously.

## Sandbox funding and escrow lifecycle

1. Create a sandbox funding intent on the trusted backend with an idempotency key and expected asset/amount.
2. Treat the browser return URL as display-only; only a sandbox provider's verified signature and server-side status may advance the simulated state.
3. Normalize events to `pending`, `settled`, `failed`, `reversed`, and `chargeback`; test duplicate, replayed, delayed, out-of-order, mismatched amount/currency, and invalid signature cases.
4. Model milestone funding, hold, release, refund, dispute freeze, and resolution as balanced ledger operations. Release requires contract milestone approval or a recorded dispute decision.
5. Reconcile provider sandbox reports against ledger totals and keep an audited support exception path.

No stage above should be connected to a real provider or real funds until separate buyer authorization and legal/security readiness.

## Membership and advertisement reward simulations

- Represent Free, Plus, Gold, and Premium as role-specific catalog entries. The prepared staging catalog sets monthly prices/limits and plan-specific fees. Renewal defaults off and requires explicit opt-in. Backend checks gate job featuring, profile boosts, advanced-search access, premium analytics, priority support, and rewards. The product still has no real billing.
- Keep tier names, prices, features, limits, and eligibility in configuration. Do not place pricing or commissions in client-only code as an authorization control.
- Advertisement rewards must be sandbox events with per-user limits, eligibility checks, and a separate reward balance that cannot be withdrawn or used as available KAV. Never reward views/clicks from a real ad network until the buyer has a compliant provider integration.
- Do not create paid subscription prompts, real advertisements, or paid benefits in the current $0 build.

## Refunds, disputes, and withdrawals

- Refunds need a defined source, destination, reason, refundable maximum, provider support, and linked reversing/settlement entries; never delete transaction history.
- Disputes freeze only the contested amount, preserve unaffected contract funds, capture evidence under an access-controlled retention policy, and provide reviewer decisions and appeals.
- Withdrawals require verified identity and payout destination, jurisdiction eligibility, sanctions/risk controls where applicable, explicit confirmation, idempotency and reconciliation. Use a pending-withdrawal account and return funds on verified failure.
- The authenticated marketplace has contract status tracking but no funds, real escrow, real dispute case operations, refunds, or withdrawals. The candidate migration models state and ledgers with fictional KAV only. No provider settlement or chargeback can occur.

## Provider selection and buyer prerequisites

The buyer must choose a regulated, jurisdiction-compatible provider after assessing marketplace/escrow support, countries, settlement, fees, disputes, refunds, webhook signing, reconciliation, identity requirements, support and data residency. Crypto support additionally needs custody, chain finality/reorg handling, key management, address screening, gas, sanctions and volatility controls.

Before any real-value launch, obtain jurisdiction-specific legal advice on payment services, money transmission, escrow, consumer protection, marketplace liability, tax, privacy, sanctions, AML/KYC and crypto duties. Complete an independent ledger/security review, threat model, penetration test, recovery plan, reconciliation ownership and written approvals from product, security, legal/compliance, and finance. The current release does not meet these gates and intentionally contains no real payment-provider adapter.
