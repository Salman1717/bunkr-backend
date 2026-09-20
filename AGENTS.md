# AGENTS.md — Bunkr Codebase & Engineering Conventions

This file records technical conventions and architectural rules for future sessions.

## 1. Project Architecture & Directory Structure
- `/api`: NestJS backend application containing controllers, services, guards, modules, and Prisma service.
- `/shared`: Pure TypeScript money math utilities (`fils.ts`), DTO definitions, interfaces, and shared constants. Shared code must have ZERO NestJS framework dependencies so it can be imported anywhere.
- `/web`: Empty placeholder directory reserved for future web app client.
- `/mobile`: Empty placeholder directory reserved for future mobile app client.

## 2. Financial Engineering & Money Handling Policy
- **Fils Standard:** All monetary amounts MUST be represented, stored, and calculated as 64-bit integer fils (`bigint`). `1 AED = 100 fils`.
- **Zero Floating-Point Policy:** Float arithmetic (`number` multiplication/addition for money) is **STRICTLY FORBIDDEN** across `/api`, `/shared`, and tests.
- **Rounding Policy:** Unrounded daily rates or division remain arbitrary ratios until individual member charge distribution. Distribution MUST use the **Largest-Remainder Algorithm (Hamilton-Hare method)** so individual integer charges sum EXACTLY to the gross total in fils.
- **Append-Only Ledger:** Financial transaction history is recorded in `LedgerEntry` as append-only rows. Adjustments are immutable. Corrections require a reversing entry linking `reversesId`.

## 3. Database & Prisma Conventions
- Money schema fields use PostgreSQL `BigInt` mapped to JS `bigint`.
- In JSON serialization, `bigint` fields MUST be converted to string representation (e.g. `"amountFils": "75000"`).
- All date filtering and month calculations assume timezone `Asia/Dubai`.

## 4. Security & Guard Rules
- All non-public routes require `JwtAuthGuard`.
- Custom guards:
  - `AdminGuard`: Requires `isAdmin == true`.
  - `CookOrAdminGuard`: Requires member to be active cook or admin.
  - `CookSelfApprovalGuard`: Explicitly prevents a cook (even if an Admin) from approving a grocery expense submitted by themselves (`submittedById == actorId`).

## 5. Month-Close Transactional Integrity
- Cycle closing runs inside a single database transaction (`prisma.$transaction`).
- The transactional engine MUST assert the master balance equation invariant:
  $$\sum \text{closing\_balance} == \sum \text{opening\_balance} + \text{NetCharges} - \text{NetPayments}$$
  If the invariant check fails by even 1 fils, the transaction rolls back immediately.

## 6. Testing Requirements
- `/shared` money utilities must have 100% unit test coverage.
- The September benchmark scenario MUST pass in `/api/test/e2e/acceptance.e2e-spec.ts`.
