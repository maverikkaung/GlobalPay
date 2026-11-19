# Financial sandbox migration 013 review

## Current state

`202611150013_simulated_financial_memberships.sql` is a candidate migration for the development branch. It has not been applied to staging or production. The only intended next deployment target is the separately approved staging project `ntucgiieksrwebwvcmun`; obtain a fresh approval before applying it there. Production and `main` are out of scope.

The implementation uses fictional integer KAV values with a fixed display reference of `1 USDT = 1 KAV`. It never calls a USDT, crypto, ad, payout, exchange, or payment API. Sample membership prices are nullable and do not charge or activate a paid subscription. Simulated withdrawal RPCs create journal records only and contain no wallet address or destination.

## Data and authorization

- User ledger accounts are created only inside a fixed-search-path definer RPC. Authenticated users cannot query raw accounts, transactions, journal entries, reward claims, or private financial configuration.
- Client-callable RPCs derive identity from `auth.uid()`, validate role/contract participation, enforce numeric limits and idempotency, and label results as simulation only.
- Every committed journal transaction must contain at least two non-zero KAV entries whose signed values sum to zero. Posted transactions and journal entries reject updates and deletes.
- Milestone state changes are participant-scoped. Only the client can place a sample hold or release/refund; the freelancer may submit work; either participant may open a dispute. Only a platform administrator may resolve a dispute, and the decision creates an admin audit entry.
- Membership plan selections are role-specific and can be changed once per cycle to prevent repeated selection from resetting usage credits. Job and application inserts consume monthly credits in a trigger; failed inserts roll back the credit event with the job/application transaction.
- Reward claims are bounded per user per day and written to the same balanced journal. No ad provider is integrated.
- Admin configuration and role plan edits are range-checked and audit logged. The public UI contains no secret configuration field.

## Validation

CI applies migrations `000`–`013` to an isolated PostgreSQL 16 fixture, then asserts table grants, RLS, function grants and absence of provider credential/destination columns. Separate disposable-database workflows cover idempotent funding, simulated withdrawals, plan role isolation, repeated plan selection, credit consumption, contract creation on hire, milestone submission/release/refund, commission arithmetic, dispute resolution, administrator authorization, reward claims and balanced journals. A CI pass validates the fixture only; it does not authorize or verify a live Supabase deployment.

Before staging approval, inspect the exact pending list and migration history, confirm project reference, review the latest CI run, take a staging backup/export, and stop on any schema or data mismatch. Do not use a service-role client to test end-user RLS. If the staging migration is later applied, verify the RPC security properties and authenticated Client/Freelancer journeys before describing the persistent sandbox as active.

## Rollback and retention

The migration is additive, but use of the new sandbox will create ledger and audit records. Do not drop financial tables as a routine rollback. First disable sandbox actions through the reviewed admin configuration, preserve a database snapshot and audit evidence, and have the database owner assess recovery. Removing source code does not remove already-created database records or revoke existing sessions.

## Deliberate non-goals

No real deposits, withdrawals, custody, stablecoin conversion, provider webhooks, spendable balances, money movement, paid membership charges, ad-network payouts, or legally binding escrow are implemented. A buyer must independently complete legal/compliance review, provider selection, KYC/AML policy, custody and key management design, reconciliation, dispute operations, incident response, independent security review, and explicit product/finance approvals before any real-value feature is designed or activated.
