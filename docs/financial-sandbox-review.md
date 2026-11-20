# Financial sandbox migration 013 review

## Current state

`202611150013_simulated_financial_memberships.sql` is a candidate migration for the development branch. It has not been applied to staging or production. The owner authorized staging-only application, but it remains gated on final CI, exact project/history/dry-run checks, and a protected logical export. Production and `main` are out of scope.

The implementation uses fictional KAV values with two decimal places and a fixed simulation reference of `1 USDT = 1 KAV`. The seeded Client plans are Free (0 KAV, 2 posts, 2%), Plus (9.99, 10, 2%), Gold (19.99, 30, 1.5%), and Premium (39.99, 100, 1%). Freelancer plans are Free (0 KAV, 5 applications, 10%), Plus (4.99, 30, 8%), Gold (9.99, 80, 6%), and Premium (19.99, 200, 5%). It never calls a USDT, crypto, ad, payout, exchange, or payment API. Simulated withdrawal RPCs create journal records only and contain no wallet address or destination.

## Data and authorization

- User ledger accounts are created only inside a fixed-search-path definer RPC. Authenticated users cannot query raw accounts, transactions, journal entries, reward claims, or private financial configuration.
- Client-callable RPCs derive identity from `auth.uid()`, validate role/contract participation, enforce numeric limits and idempotency, and label results as simulation only. Paid sample plans debit the same two-decimal KAV amount at the 1:1 reference rate. Renewal is off by default and is debited only after a member explicitly opts in; insufficient balance falls back to Free without overdraft.
- Every committed journal transaction must contain at least two non-zero KAV entries whose signed values sum to zero. Posted transactions and journal entries reject updates and deletes.
- Milestone state changes are participant-scoped. The client service fee and freelancer commission are snapshotted from their plans when each milestone is created. Funding, release, and refund post balanced entries using the snapshots; only the client can fund or release/refund, the freelancer may submit work, either participant may open a dispute, and only a platform administrator may resolve it. No provider settlement or money movement occurs.
- Membership plan selections are role-specific and can be changed once per cycle to prevent repeated selection from resetting usage credits. Job and application inserts consume monthly credits in a trigger; failed inserts roll back the credit event with the job/application transaction.
- Reward claims are limited to eligible plans and bounded per user per day. They accrue to a separate non-withdrawable reward account, not the available balance. No ad provider is integrated.
- Admin configuration and role plan edits are range-checked and audit logged. Per-plan benefits are validated JSON entitlements; featured-job placement, profile boost, advanced-search access, analytics, priority support, and ad rewards have server-side checks. The public UI contains no secret configuration field.

## Validation

CI applies migrations `000`–`013` to an isolated PostgreSQL 16 fixture, then asserts table grants, RLS, function grants, exact plan catalog values, explicit renewal defaults, two-decimal ledger precision, and absence of provider credential/destination columns. Separate disposable-database workflows cover idempotent funding, simulated withdrawals, role plan isolation, usage limits, renewal consent/fallback, two-decimal milestone fees, contract transitions, dispute resolution, admin authorization, reward separation, and balanced/nonnegative journals. A CI pass validates the fixture only; it does not itself apply or verify the staging database.

Before staging application, confirm project reference `ntucgiieksrwebwvcmun`, confirm only migration 013 is pending, inspect dry-run output, review the latest CI run, and create a protected staging logical export. Stop on any schema or data mismatch. Do not use a service-role client to test end-user RLS. If the migration is applied, verify the RPC security properties and authenticated Client/Freelancer journeys before describing the persistent sandbox as active.

## Rollback and retention

The migration is additive, but use of the new sandbox will create ledger and audit records. Do not drop financial tables as a routine rollback. First pause sandbox actions through the reviewed admin configuration, preserve the logical export and audit evidence, and have the database owner assess recovery. Removing source code does not remove already-created database records or revoke existing sessions. Staging reported no managed physical backups/PITR snapshots at the last check, so a successful logical export is a precondition to application.

## Deliberate non-goals

No real deposits, withdrawals, custody, stablecoin conversion, provider webhooks, spendable real-world balances, money movement, real membership charges, ad-network payouts, or legally binding escrow are implemented. Membership purchase and renewal are simulated KAV journal entries only. A buyer must independently complete legal/compliance review, provider selection, KYC/AML policy, custody and key management design, reconciliation, dispute operations, incident response, independent security review, and explicit product/finance approvals before any real-value feature is designed or activated.
