# KAV Wallet — Future Architecture Specification

**Status:** Design only. No wallet, deposits, withdrawals, crypto payments, exchange, or spendable balance is enabled in TechKarvo. The reference accounting unit is `1 KAV = 1 USD`; this is a design convention, not a promise of redemption or a live exchange rate.

## Service boundaries

- Keep marketplace identity and contracts separate from financial custody and payment processing.
- A future wallet must be a separately reviewed service with a ledger API, a provider adapter, reconciliation jobs, an immutable audit trail, and explicit operational controls.
- Browser clients must never receive provider secrets, signing keys, custodial keys, privileged database credentials, or permission to write ledger entries directly.
- Contract status alone must never imply payment, escrow, or funds availability.

## Double-entry ledger

- Use append-only journal entries. Every posted transaction must have at least two lines, all in one currency, whose signed amounts sum to zero.
- Store integer minor units (for USD, cents) rather than floating point. The KAV display conversion is a versioned accounting rule; rounding is explicit and never silently discards value.
- Separate accounts by owner and purpose: platform clearing, user available, user held, funding pending, provider payable, refund payable, withdrawal pending, fees, and loss/dispute reserve.
- A unique idempotency key and external provider reference prevent duplicate funding, release, refund, or payout entries.
- Posted entries cannot be edited or deleted. Corrections use a linked reversing transaction with actor, reason, original transaction ID, and timestamp.
- Enforce account ownership, currency, state transitions, balanced journals, and idempotency in trusted server/database logic. Reconcile per-account and global totals continuously.

## Funding verification

- Accept funding only from an approved payment provider after server-verified, signed webhook events and provider-side status confirmation.
- Treat browser return URLs as display hints only. They are never proof of settlement.
- Record pending, settled, failed, reversed, and chargeback states separately. Do not credit spendable funds before settlement criteria are met.
- Verify webhook signatures, timestamps, replay protection, event ordering, amount, currency, payer, and destination. Store a minimal immutable provider event reference and sanitized evidence.
- Run scheduled provider-to-ledger reconciliation, alert on unmatched transactions, and provide an audited manual exception workflow with dual control.

## Contract holds, release, refunds, and disputes

- Create a hold only when a signed/approved contract milestone, amount, currency, funding source, and both parties are recorded and funds are verified as settled.
- Move value from available to held with a balanced journal transaction. A hold is not a transfer to the freelancer and not proof of work completion.
- Release requires the agreed approval rule or a documented dispute resolution. Each release is idempotent and linked to the contract and milestone.
- Refunds require a defined source, destination, reason, maximum refundable amount, and provider support. Refunds reverse or settle prior entries; they do not delete history.
- Disputes freeze only the contested amount, preserve unaffected contract funds, capture evidence references under an access-controlled retention policy, and record reviewer decisions and appeal paths.
- Reconcile contract totals against held, released, refunded, and disputed balances. Never infer a payment from job-application acceptance.

## Withdrawals

- Require verified identity, verified payout destination, current account security checks, eligibility and sanctions screening where legally required, risk review, and explicit user confirmation.
- Use a withdrawal state machine (requested, screening, approved, submitted, settled, failed, cancelled). Do not debit a user's available balance permanently until payout handling is defined; reserve funds in a pending-withdrawal account and return them on a verified failure.
- Apply idempotency, velocity/amount limits, dual-control overrides, provider reconciliation, user notifications, and audited support resolution.
- Never expose bank details, wallet addresses, identity documents, or provider responses in public profile APIs or client logs.

## Possible provider and crypto integrations

- Evaluate regulated card/bank providers for fiat funding and payouts based on supported jurisdictions, marketplace/escrow products, dispute handling, webhooks, settlement timing, fees, and compliance coverage.
- For crypto, evaluate a regulated, jurisdiction-compatible custody/payment provider before considering direct on-chain support. A provider adapter should isolate chain-specific confirmations, custody, signing, gas, address screening, sanctions controls, volatility, and reorg handling.
- Do not implement a token, exchange, stable-value promise, direct key custody, bridge, or user-to-user transfer until legal, custody, consumer-protection, tax, and licensing analysis is complete.
- Keep provider-specific transaction state outside the product domain model; normalize it through a versioned adapter and reconciled ledger events.

## Compliance, privacy, and operations prerequisites

- Obtain legal analysis for every launch country covering money transmission/payment services, escrow rules, consumer protection, marketplace liability, taxation/reporting, privacy, sanctions, AML, and crypto-specific obligations.
- Determine whether KYC/AML, customer due diligence, sanctions screening, suspicious-activity escalation, transaction monitoring, records retention, and regulatory reporting apply. Select qualified providers and define the responsible regulated entity before launch.
- Define data minimization, retention/deletion rules, access logs, encryption/key management, incident response, fraud controls, appeals, customer support, and financial reconciliation ownership.
- Complete threat modeling, penetration testing, independent ledger review, disaster recovery, operational runbooks, and jurisdiction-specific approval before enabling any value movement.
- Require separate product, security, legal/compliance, and finance approvals before any wallet or payment feature is activated.
