# Bunkr — Backend API Requirements & Specification Document

**Version:** 1.0.0  
**Status:** Approved Specification  
**Timezone Baseline:** `Asia/Dubai`  
**Currency Unit:** Integer Fils (`1 AED = 100 fils`)

---

## 1. Scope and Non-Goals

### 1.1 In-Scope
* **Stack:** Node.js 20+, TypeScript, NestJS framework, Prisma ORM, PostgreSQL database (`docker-compose.yml` for containerized PostgreSQL).
* **Architecture:** Modular NestJS architecture organized into `/api` (NestJS backend), `/shared` (money math utilities, common DTOs, types), `/web` (placeholder), `/mobile` (placeholder).
* **Authentication & Authorization:** JWT authentication (15-minute access token, 30-day rotating refresh token), cookie/header bearer transport, role-based and permission-based NestJS guards.
* **Money Engine:** Strict 64-bit integer (`bigint`) math in fils (`1 AED = 100 fils`). Zero floating-point arithmetic across the codebase and tests.
* **Domain Modules:**
  * Member & Membership Management (ROOM, MESS, WATER support; cook flag; admin grant).
  * Room & Bed Management (bed-level monthly rent).
  * Effective-Dated House Settings (cook charge default, water split mode, late absence cut-off time, adjustment warning threshold).
  * Daily Absences & Headcount (meal-granularity absences: Breakfast 0.2, Lunch 0.4, Dinner 0.4; 1-click day absence; late absence approval workflow).
  * Shared Expense Management & Approval State Machine (categories: GROCERY, WATER, ROOM, SHARED_ITEM; split scopes: ALL_ROOM, SINGLE_ROOM, CUSTOM, ALL_MEMBERS; cook self-approval guard).
  * Water Delivery & Consumption Tracking (EQUAL vs. BY_CONSUMPTION split modes).
  * Immutable Admin Adjustments & Reversals (DEBIT / CREDIT with strict reason verification and optional attachments).
  * Payments & Ledger Management (append-only ledger entries, multi-tier partial payment allocation breakdown).
  * Cycle Preview & Closing Engine (live preview, single-transaction month close with balance invariant assertion, emergency reopen with audit logging).
  * Audit Logging (every admin state change, approval, adjustment, setting change tracked with actor, timestamp, before/after snapshots).
  * OpenAPI / Swagger Documentation served at `/api/docs`.

### 1.2 Non-Goals
* **Frontend User Interfaces:** No web (`/web`) or mobile (`/mobile`) UI components built in this phase.
* **Automated Payment Gateways:** Integration with Stripe, PayPal, or UAE Central Bank payment systems (all payments are recorded manually by Admins upon bank transfer/cash receipt).
* **Third-Party Notifications:** SMS, WhatsApp, or Push notifications (audit logs and endpoints serve status updates).
* **Receipt OCR Parsing:** Receipt images are stored as URI strings without server-side text extraction.

---

## 2. Domain Glossary

| Term | Definition |
| :--- | :--- |
| **Member** | The single account entity representing a person residing or eating in the bunkr. |
| **Membership** | A contextual subscription held by a member for a specific cycle: `ROOM` (occupying a bed), `MESS` (eating food), `WATER` (drinking shared water). A member can hold multiple simultaneously. |
| **Cook** | A flag with a date range on a `MESS` membership. Fronts grocery purchases and receives pooled cook credits. |
| **Admin** | A role grant assigned to a member. Grants management and approval capabilities while maintaining standard billing. |
| **Cycle** | A calendar month (1st day 00:00:00 to last day 23:59:59 `Asia/Dubai`) in status `OPEN`, `CLOSING`, or `CLOSED`. |
| **Fils** | Sub-currency unit of AED. `100 fils = 1.00 AED`. All financial data stored as `bigint`. |
| **Man-Days** | The total actual meals consumed by all mess members in a cycle, measured in days (`consumed_days = cycle_days - sum(absences)`). |
| **Daily Rate** | Unrounded cost per man-day (`grocery_total / total_man_days`). |
| **Largest-Remainder** | Mathematical algorithm (Hamilton-Hare method) used to distribute rounding residue when allocating unrounded fils across members. |
| **Ledger Entry** | Immutable, append-only financial transaction record. |
| **Closing Balance** | Net position at cycle end: `Positive` = member owes house; `Negative` = house owes member (credit). |

---

## 3. Billing Rules & Mathematical Formulas

### 3.1 Financial Calculations & Precision Policy
1. **Integer Arithmetic:** All monetary fields in Prisma and TypeScript MUST use `bigint` representing integer fils.
2. **No Floats:** Intermediate values for daily mess rates and prorated rent use arbitrary-precision rational division or scaled integer math before final distribution.
3. **Rounding Policy:** Rounding occurs **ONLY** on each member's final charge for a line item using the **Largest-Remainder Method (Hamilton-Hare)**.

---

### 3.2 Rent Billing Rule
Rent is attached to a **Bed** (default 65,000 fils [650 AED] or 75,000 fils [750 AED]), admin-editable. Rent is charged on Day 1 of the cycle.

$$\text{Rent}_{\text{standard}}(m) = \text{Bed.monthly\_rent\_fils}$$

If `prorate_rent == true` on a `ROOM` membership:

$$\text{Rent}_{\text{prorated}}(m) = \left\lfloor \frac{\text{Bed.monthly\_rent\_fils} \times \text{occupied\_days}}{\text{days\_in\_cycle}} \right\rfloor$$

Any unallocated fils from floor truncation across prorated room members are assigned to members with the largest fractional remainders.

---

### 3.3 Mess (Grocery) Billing Rule
1. **Grocery Total ($G$):** Sum of all `APPROVED` expenses with category `GROCERY` in the cycle.
2. **Absence Weights:**
   * Breakfast = $0.2$
   * Lunch = $0.4$
   * Dinner = $0.4$
   * Full Day Absence = $1.0$ (0 consumed days)
3. **Member Consumed Days ($D_m$):**

$$D_m = \text{days\_in\_cycle} - \sum_{\text{day} \in \text{cycle}} (0.2 \cdot b_{\text{absent}} + 0.4 \cdot l_{\text{absent}} + 0.4 \cdot d_{\text{absent}})$$

4. **Total Man-Days ($M$):**

$$M = \sum_{m \in \text{MESS}} D_m$$

5. **Daily Rate ($R_{daily}$):**

$$R_{daily} = \frac{G}{M}$$

6. **Raw Mess Charge ($C_m^{\text{raw}}$):**

$$C_m^{\text{raw}} = R_{daily} \times D_m = \frac{G \cdot D_m}{M}$$

7. **Integer Allocation via Largest-Remainder:**
   * Floor charge: $C_m^{\text{floor}} = \lfloor C_m^{\text{raw}} \rfloor$
   * Remainder: $r_m = C_m^{\text{raw}} - C_m^{\text{floor}}$
   * Total integer allocated: $S = \sum C_m^{\text{floor}}$
   * Residue to distribute: $K = G - S$
   * Members sorted descending by $r_m$; top $K$ members get $+1$ fils.
8. **Residue Protection:** If $M = 0$ and $G > 0$, cycle close is blocked or grocery total carries over (see Edge Cases).

---

### 3.4 Cook Charge & Cook Credit Rule
1. **Cook Charge ($CC$):** Flat monthly fee per mess member configured in `Setting` (`cook_charge_per_member`, default 5,000 fils = 50 AED).
2. **Mess Member Charge:** Every active `MESS` member (including cooks) is billed $CC$.
3. **Cook Credit Pool ($CP$):**

$$CP = CC \times |\text{MESS\_MEMBERS}|$$

4. **Cook Credit Split:**

$$\text{CookCredit}(c) = \left\lfloor CP \times \frac{\text{cook\_days}(c)}{\text{total\_active\_cook\_days}} \right\rfloor$$

Remainder fils allocated via largest remainder distribution to active cooks.

---

### 3.5 Water Billing Rule
1. **Delivery Logging:** Logged with `bottle_count` and `unit_price_fils`. Total Water Cost $W = \sum (\text{bottle\_count} \times \text{unit\_price\_fils})$.
2. **Split Mode: `EQUAL`:**
   * $W$ divided equally among all active `WATER` subscribers using Largest-Remainder distribution.
3. **Split Mode: `BY_CONSUMPTION`:**
   * Each water take logged per member $T_m$.
   * Total takes $T_{total} = \sum T_m$.
   * Charge: $\text{WaterCharge}(m) = T_m \times \text{unit\_price\_fils}$.

---

### 3.6 Shared Expenses & Approval Engine
When an expense is `APPROVED` by an admin:
1. **Payer Credit:** Immediate ledger credit to submitter for full `amount_fils`.
2. **Category Split:**
   * `GROCERY`: Added to cycle grocery pool $G$. No immediate member charges.
   * `ROOM` / `SHARED_ITEM` / `WATER`: Split immediately among members in `split_scope`.
     * `ALL_ROOM`: All active `ROOM` members.
     * `SINGLE_ROOM`: All active `ROOM` members in `target_room_id`.
     * `CUSTOM`: Specifically listed `member_ids`.
     * `ALL_MEMBERS`: All active members across the household.
3. **Individual Expense Share:**

$$\text{Share}(m) = \left\lfloor \frac{\text{amount\_fils}}{N_{\text{scope}}} \right\rfloor + \text{largest\_remainder\_adjust}(m)$$

---

### 3.7 Admin Adjustments
* Directions: `DEBIT` (member owes more) or `CREDIT` (member owes less).
* Server-side guard enforces `reason.length >= 10`.
* Warning flag returned if `amount_fils > adjustment_warning_threshold` (default 20,000 fils = 200 AED).
* Reversals create an opposite direction adjustment linked via `reverses_id`.

---

### 3.8 Balance Equation & Invariant Assertion
The closing balance for member $m$ at the end of cycle $C$ is defined as:

$$\begin{aligned}
\text{closing\_balance}(m) = \, & \text{opening\_balance}(m) \\
& + \sum \text{Rent}(m) + \sum \text{MessCharge}(m) + \sum \text{CookCharge}(m) \\
& + \sum \text{WaterCharge}(m) + \sum \text{ExpenseShares}(m) + \sum \text{DebitAdjustments}(m) \\
& - \sum \text{CookCredit}(m) - \sum \text{ExpenseFrontedCredits}(m) \\
& - \sum \text{CreditAdjustments}(m) - \sum \text{Payments}(m)
\end{aligned}$$

#### Cycle Close Invariant Assertion
Before committing the atomic transaction closing cycle $C$:

$$\sum_{m \in \text{Members}} \text{closing\_balance}(m) == \sum_{m \in \text{Members}} \text{opening\_balance}(m) + \text{NetCycleCharges} - \text{NetCyclePayments}$$

If this equality fails down to the exact fils, the transaction is **rolled back**.

---

### 3.9 Partial Payment Allocation Hierarchy
For display and breakdown reporting, partial payments are allocated against charges in the following strict priority:
1. **Arrears** (Unpaid balance from past cycles, oldest first)
2. **Rent Charges**
3. **Mess & Cook Charges**
4. **Water Charges**
5. **Approved Expense Shares**
6. **Debit Adjustments**
7. **Credit Remainder** (Carried forward to next cycle)

---

## 4. Data Model (Prisma Schema Specification)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  MEMBER
  ADMIN
}

enum MembershipType {
  ROOM
  MESS
  WATER
}

enum CycleStatus {
  OPEN
  CLOSING
  CLOSED
}

enum AbsenceStatus {
  PENDING_APPROVAL
  APPROVED
  REJECTED
}

enum ExpenseCategory {
  GROCERY
  WATER
  ROOM
  SHARED_ITEM
}

enum SplitScope {
  ALL_ROOM
  SINGLE_ROOM
  CUSTOM
  ALL_MEMBERS
}

enum ExpenseStatus {
  PENDING
  APPROVED
  REJECTED
}

enum AdjustmentDirection {
  DEBIT
  CREDIT
}

enum AdjustmentCategory {
  GUEST_STAY
  DAMAGE
  LATE_FEE
  GOODWILL
  CORRECTION
  SETTLEMENT
  OTHER
}

enum WaterSplitMode {
  EQUAL
  BY_CONSUMPTION
}

enum LedgerEntryType {
  RENT
  MESS
  COOK_CHARGE
  COOK_CREDIT
  WATER
  EXPENSE_CREDIT
  EXPENSE_SHARE
  ADJUSTMENT_DEBIT
  ADJUSTMENT_CREDIT
  PAYMENT
  ROUNDING_ADJUSTMENT
}

model Member {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String   @map("password_hash")
  firstName     String   @map("first_name")
  lastName      String   @map("last_name")
  isAdmin       Boolean  @default(false) @map("is_admin")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  memberships        Membership[]
  absences           Absence[]            @relation("MemberAbsences")
  approvedAbsences   Absence[]            @relation("ApprovedAbsences")
  submittedExpenses  Expense[]            @relation("SubmittedExpenses")
  approvedExpenses   Expense[]            @relation("ApprovedExpenses")
  expenseSplits      ExpenseSplit[]
  adjustments        Adjustment[]         @relation("TargetMemberAdjustments")
  createdAdjustments Adjustment[]         @relation("CreatedAdjustments")
  payments           Payment[]            @relation("MemberPayments")
  recordedPayments   Payment[]            @relation("RecordedPayments")
  ledgerEntries      LedgerEntry[]
  statements         Statement[]
  auditLogs          AuditLog[]
  waterDeliveries    WaterDelivery[]      @relation("LoggedWaterDeliveries")
  waterTakes         WaterTake[]
  closedCycles       Cycle[]              @relation("ClosedCycles")
  createdSettings    Setting[]

  @@map("members")
}

model Room {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  beds     Bed[]
  expenses Expense[] @relation("RoomTargetExpenses")

  @@map("rooms")
}

model Bed {
  id              String   @id @default(uuid())
  roomId          String   @map("room_id")
  name            String
  defaultRentFils BigInt   @default(65000) @map("default_rent_fils")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  room        Room         @relation(fields: [roomId], references: [id], onDelete: Cascade)
  memberships Membership[]

  @@unique([roomId, name])
  @@map("beds")
}

model Membership {
  id           String         @id @default(uuid())
  memberId     String         @map("member_id")
  type         MembershipType
  bedId        String?        @map("bed_id")
  startDate    DateTime       @map("start_date")
  endDate      DateTime?      @map("end_date")
  prorateRent  Boolean        @default(false) @map("prorate_rent")
  isCook       Boolean        @default(false) @map("is_cook")
  cookStartDate DateTime?     @map("cook_start_date")
  cookEndDate   DateTime?     @map("cook_end_date")
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")

  member Member @relation(fields: [memberId], references: [id], onDelete: Cascade)
  bed    Bed?   @relation(fields: [bedId], references: [id], onDelete: SetNull)

  @@map("memberships")
}

model Cycle {
  id           String      @id @default(uuid())
  name         String      @unique // e.g. "2026-09"
  startDate    DateTime    @map("start_date")
  endDate      DateTime    @map("end_date")
  status       CycleStatus @default(OPEN)
  closedAt     DateTime?   @map("closed_at")
  closedById   String?     @map("closed_by_id")
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")

  closedBy        Member?         @relation("ClosedCycles", fields: [closedById], references: [id])
  absences        Absence[]
  expenses        Expense[]
  adjustments     Adjustment[]
  payments        Payment[]
  ledgerEntries   LedgerEntry[]
  statements      Statement[]
  waterDeliveries WaterDelivery[]

  @@map("cycles")
}

model Setting {
  id            String   @id @default(uuid())
  key           String
  valueJson     Json     @map("value_json")
  effectiveFrom DateTime @default(now()) @map("effective_from")
  createdById   String   @map("created_by_id")
  createdAt     DateTime @default(now()) @map("created_at")

  createdBy Member @relation(fields: [createdById], references: [id])

  @@map("settings")
}

model Absence {
  id           String        @id @default(uuid())
  memberId     String        @map("member_id")
  cycleId      String        @map("cycle_id")
  date         DateTime      @db.Date
  breakfast    Boolean       @default(true)
  lunch        Boolean       @default(true)
  dinner       Boolean       @default(true)
  isLate       Boolean       @default(false) @map("is_late")
  status       AbsenceStatus @default(APPROVED)
  approvedById String?       @map("approved_by_id")
  createdAt    DateTime      @default(now()) @map("created_at")

  member     Member  @relation("MemberAbsences", fields: [memberId], references: [id], onDelete: Cascade)
  cycle      Cycle   @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  approvedBy Member? @relation("ApprovedAbsences", fields: [approvedById], references: [id])

  @@unique([memberId, date])
  @@map("absences")
}

model WaterDelivery {
  id             String   @id @default(uuid())
  cycleId        String   @map("cycle_id")
  date           DateTime @db.Date
  bottleCount    Int      @map("bottle_count")
  unitPriceFils  BigInt   @map("unit_price_fils")
  loggedById     String   @map("logged_by_id")
  createdAt      DateTime @default(now()) @map("created_at")

  cycle    Cycle       @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  loggedBy Member      @relation("LoggedWaterDeliveries", fields: [loggedById], references: [id])
  takes    WaterTake[]

  @@map("water_deliveries")
}

model WaterTake {
  id              String   @id @default(uuid())
  waterDeliveryId String   @map("water_delivery_id")
  memberId        String   @map("member_id")
  bottleCount     Int      @map("bottle_count")
  createdAt       DateTime @default(now()) @map("created_at")

  waterDelivery WaterDelivery @relation(fields: [waterDeliveryId], references: [id], onDelete: Cascade)
  member        Member        @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@map("water_takes")
}

model Expense {
  id              String          @id @default(uuid())
  cycleId         String          @map("cycle_id")
  submittedById   String          @map("submitted_by_id")
  category        ExpenseCategory
  splitScope      SplitScope      @map("split_scope")
  targetRoomId    String?         @map("target_room_id")
  amountFils      BigInt          @map("amount_fils")
  description     String
  receiptUrl      String?         @map("receipt_url")
  status          ExpenseStatus   @default(PENDING)
  rejectionReason String?         @map("rejection_reason")
  approvedById    String?         @map("approved_by_id")
  approvedAt      DateTime?       @map("approved_at")
  createdAt       DateTime        @default(now()) @map("created_at")

  cycle       Cycle          @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  submittedBy Member         @relation("SubmittedExpenses", fields: [submittedById], references: [id])
  approvedBy  Member?        @relation("ApprovedExpenses", fields: [approvedById], references: [id])
  targetRoom  Room?          @relation("RoomTargetExpenses", fields: [targetRoomId], references: [id])
  splits      ExpenseSplit[]

  @@map("expenses")
}

model ExpenseSplit {
  id         String @id @default(uuid())
  expenseId  String @map("expense_id")
  memberId   String @map("member_id")
  shareFils  BigInt @map("share_fils")

  expense Expense @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  member  Member  @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([expenseId, memberId])
  @@map("expense_splits")
}

model Adjustment {
  id            String              @id @default(uuid())
  memberId      String              @map("member_id")
  cycleId       String              @map("cycle_id")
  direction     AdjustmentDirection
  amountFils    BigInt              @map("amount_fils")
  category      AdjustmentCategory
  reason        String
  attachmentUrl String?             @map("attachment_url")
  createdById   String              @map("created_by_id")
  reversesId    String?             @unique @map("reverses_id")
  reversedById  String?             @map("reversed_by_id")
  createdAt     DateTime            @default(now()) @map("created_at")

  member    Member      @relation("TargetMemberAdjustments", fields: [memberId], references: [id])
  cycle     Cycle       @relation(fields: [cycleId], references: [id])
  createdBy Member      @relation("CreatedAdjustments", fields: [createdById], references: [id])
  reverses  Adjustment? @relation("AdjustmentReversals", fields: [reversesId], references: [id])
  reversedBy Adjustment? @relation("AdjustmentReversals")

  @@map("adjustments")
}

model Payment {
  id              String   @id @default(uuid())
  memberId        String   @map("member_id")
  cycleId         String   @map("cycle_id")
  amountFils      BigInt   @map("amount_fils")
  paymentDate     DateTime @map("payment_date")
  referenceNumber String?  @map("reference_number")
  notes           String?
  recordedById    String   @map("recorded_by_id")
  createdAt       DateTime @default(now()) @map("created_at")

  member     Member @relation("MemberPayments", fields: [memberId], references: [id])
  cycle      Cycle  @relation(fields: [cycleId], references: [id])
  recordedBy Member @relation("RecordedPayments", fields: [recordedById], references: [id])

  @@map("payments")
}

model LedgerEntry {
  id          String          @id @default(uuid())
  cycleId     String          @map("cycle_id")
  memberId    String          @map("member_id")
  type        LedgerEntryType
  amountFils  BigInt          @map("amount_fils") // Positive = Debit (charge), Negative = Credit (payment/refund)
  description String
  referenceId String?         @map("reference_id")
  createdAt   DateTime        @default(now()) @map("created_at")

  cycle  Cycle  @relation(fields: [cycleId], references: [id])
  member Member @relation(fields: [memberId], references: [id])

  @@map("ledger_entries")
}

model Statement {
  id                   String   @id @default(uuid())
  cycleId              String   @map("cycle_id")
  memberId             String   @map("member_id")
  openingBalanceFils   BigInt   @map("opening_balance_fils")
  closingBalanceFils   BigInt   @map("closing_balance_fils")
  rentChargeFils       BigInt   @default(0) @map("rent_charge_fils")
  messChargeFils       BigInt   @default(0) @map("mess_charge_fils")
  cookChargeFils       BigInt   @default(0) @map("cook_charge_fils")
  cookCreditFils       BigInt   @default(0) @map("cook_credit_fils")
  waterChargeFils      BigInt   @default(0) @map("water_charge_fils")
  expenseChargeFils    BigInt   @default(0) @map("expense_charge_fils")
  expenseCreditFils    BigInt   @default(0) @map("expense_credit_fils")
  debitAdjustmentsFils BigInt   @default(0) @map("debit_adjustments_fils")
  creditAdjustmentsFils BigInt  @default(0) @map("credit_adjustments_fils")
  paymentsFils         BigInt   @default(0) @map("payments_fils")
  generatedAt          DateTime @default(now()) @map("generated_at")

  cycle  Cycle  @relation(fields: [cycleId], references: [id])
  member Member @relation(fields: [memberId], references: [id])

  @@unique([cycleId, memberId])
  @@map("statements")
}

model AuditLog {
  id         String   @id @default(uuid())
  actorId    String   @map("actor_id")
  action     String
  entityType String   @map("entity_type")
  entityId   String   @map("entity_id")
  beforeJson Json?    @map("before_json")
  afterJson  Json?    @map("after_json")
  timestamp  DateTime @default(now())

  actor Member @relation(fields: [actorId], references: [id])

  @@map("audit_logs")
}
```

---

## 5. Full API Surface & Request/Response Shapes

### 5.1 Authentication (`/api/auth`)
* `POST /api/auth/register` (Admin created / Bootstrap)
* `POST /api/auth/login` -> Returns `{ accessToken, refreshToken, user }`
* `POST /api/auth/refresh` -> Returns `{ accessToken, refreshToken }`
* `GET /api/auth/me` -> Returns current member payload with memberships & role flags.

#### Request / Response Sample: Login
```json
// POST /api/auth/login
{
  "email": "arun@bunkr.ae",
  "password": "SecurePassword123!"
}

// Response 200 OK
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "d8f92a10...",
  "user": {
    "id": "mem-arun-uuid",
    "email": "arun@bunkr.ae",
    "firstName": "Arun",
    "lastName": "Kumar",
    "isAdmin": true,
    "memberships": [
      { "type": "ROOM", "bedId": "bed-r1-1" },
      { "type": "MESS", "isCook": true },
      { "type": "WATER" }
    ]
  }
}
```

---

### 5.2 Members & Memberships (`/api/members`)
* `GET /api/members` (Admin only)
* `POST /api/members` (Admin only)
* `POST /api/members/:id/memberships` (Admin only)
* `PATCH /api/members/:id/memberships/:membershipId` (Admin only)

---

### 5.3 Rooms & Beds (`/api/rooms`, `/api/beds`)
* `GET /api/rooms`
* `POST /api/rooms` (Admin only)
* `POST /api/beds` (Admin only)
* `PATCH /api/beds/:id` (Admin only - edit default rent)

---

### 5.4 Cycles (`/api/cycles`)
* `GET /api/cycles`
* `POST /api/cycles` (Admin only - open new cycle)
* `GET /api/cycles/:id/preview` -> Computes live balances, preview charges, zero side-effects.
* `POST /api/cycles/:id/close` (Admin only - runs single DB transaction, asserts invariant, writes statements & ledger).
* `POST /api/cycles/:id/reopen` (Admin only - break-glass action, requires audit logging).

#### Response Sample: Preview (`GET /api/cycles/:id/preview`)
```json
{
  "cycleId": "cycle-2026-09",
  "status": "OPEN",
  "groceryTotalFils": "240000",
  "totalManDays": 100.0,
  "dailyRateFils": "2400",
  "members": [
    {
      "memberId": "mem-arun-uuid",
      "memberName": "Arun Kumar",
      "openingBalanceFils": "0",
      "rentFils": "75000",
      "messFils": "72000",
      "cookChargeFils": "5000",
      "cookCreditFils": "-20000",
      "waterFils": "4900",
      "expenseChargesFils": "16500",
      "expenseCreditsFils": "-240000",
      "closingBalanceFils": "-86600"
    }
  ]
}
```

---

### 5.5 Absences & Headcount (`/api/absences`)
* `POST /api/absences/my-absence` -> Body `{ date: "2026-09-15" }` (Sets breakfast=false, lunch=false, dinner=false).
* `POST /api/absences` -> Detailed meal selection `{ date, breakfast, lunch, dinner }`.
* `GET /api/absences/headcount?date=2026-09-15` (Cook/Admin only) -> Returns count of present members per meal.
* `POST /api/absences/:id/approve` (Admin only - for late absences submitted after 22:00 cut-off).

---

### 5.6 Expenses & Approvals (`/api/expenses`)
* `POST /api/expenses` -> Submit purchase with receipt, status `PENDING`.
* `GET /api/expenses` -> Shared feed visible to all members.
* `POST /api/expenses/:id/approve` (Admin only, Cook self-approval BLOCKED).
* `POST /api/expenses/:id/reject` (Admin only, requires `rejectionReason`).

#### Request Sample: Submit Expense
```json
// POST /api/expenses
{
  "cycleId": "cycle-2026-09",
  "category": "ROOM",
  "splitScope": "SINGLE_ROOM",
  "targetRoomId": "room-1-uuid",
  "amountFils": "30000",
  "description": "Water heater replacement",
  "receiptUrl": "https://storage.bunkr.ae/receipts/r-102.jpg"
}
```

---

### 5.7 Water Management (`/api/water`)
* `POST /api/water/deliveries` (Cook / Admin) -> Body `{ date, bottleCount, unitPriceFils }`.
* `POST /api/water/takes` -> Body `{ waterDeliveryId, memberId, bottleCount }`.
* `GET /api/water/deliveries`

---

### 5.8 Admin Adjustments (`/api/adjustments`)
* `POST /api/adjustments` (Admin only)
* `POST /api/adjustments/:id/reverse` (Admin only)

#### Request Sample: Post Adjustment
```json
// POST /api/adjustments
{
  "memberId": "mem-bilal-uuid",
  "cycleId": "cycle-2026-09",
  "direction": "DEBIT",
  "amountFils": "5000",
  "category": "DAMAGE",
  "reason": "Damaged microwave door in common area"
}
```

---

### 5.9 Payments (`/api/payments`)
* `POST /api/payments` (Admin only) -> Body `{ memberId, cycleId, amountFils, paymentDate, referenceNumber }`.

---

### 5.10 Statements & Audit Logs (`/api/statements`, `/api/audit-log`)
* `GET /api/statements/my` -> Own statements across cycles.
* `GET /api/statements/member/:id` (Admin only)
* `GET /api/ledger/my` -> Itemized append-only ledger entries for current member.
* `GET /api/audit-log` -> Shared transparency feed of state modifications.

---

## 6. Role & Permission Matrix

Enforced strictly via custom NestJS Guards (`@Roles()`, `@Permissions()`, `@MembershipRequired()`).

| Capability / Endpoint | Room | Mess | Cook | Admin | Guard Enforcement Rule |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **See Own Statement & Ledger** | Yes | Yes | Yes | Yes | `JwtAuthGuard`, `OwnResourceGuard` |
| **Submit Purchase for Approval** | Yes | Yes | Yes | Yes | `JwtAuthGuard` |
| **See Shared Expense Feed & Audit Log** | Yes | Yes | Yes | Yes | `JwtAuthGuard` |
| **Log Own Absence** | No | Yes | Yes | Yes | `MembershipGuard(MESS)` |
| **See Grocery Ledger Detail** | No | Yes | Yes | Yes | `MembershipGuard(MESS)` |
| **See Room Expense Detail** | Yes | No | — | Yes | `MembershipGuard(ROOM)` |
| **See Daily Headcount** | No | No | Yes | Yes | `CookOrAdminGuard` |
| **Log Grocery Bills** | No | No | Yes | Yes | `CookOrAdminGuard` |
| **Approve / Reject Expenses** | No | No | No | Yes | `AdminGuard` **AND** `CookSelfApprovalGuard` |
| **Post / Reverse Adjustments** | No | No | No | Yes | `AdminGuard` |
| **Record Member Payments** | No | No | No | Yes | `AdminGuard` |
| **Manage Members, Beds, Rent** | No | No | No | Yes | `AdminGuard` |
| **Close or Reopen Cycle** | No | No | No | Yes | `AdminGuard` |
| **See Other Members' Balances** | No | No | No | Yes | `AdminGuard` |

---

## 7. Month-Close Sequence

Executing `POST /api/cycles/:id/close` initiates a single PostgreSQL transaction (`prisma.$transaction`) following this sequence:

```
+-----------------------------------------------------------------------+
| 1. Acquire PESSIMISTIC LOCK on Cycle (status == OPEN)                 |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
| 2. Fetch Effective-Dated Settings (cook charge, water mode, etc.)     |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
| 3. Calculate Rent Charges per Room Member (standard vs. prorated)     |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
| 4. Calculate Mess Pool Total (approved GROCERY expenses)              |
|    Calculate Consumed Days & Man-Days per Mess Member                 |
|    Compute Mess Charge via Largest-Remainder Distribution             |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
| 5. Calculate Cook Charges & Pooled Cook Credit Distribution           |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
| 6. Calculate Water Charges (EQUAL or BY_CONSUMPTION)                  |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
| 7. Sum Non-Grocery Expense Shares & Admin Adjustments                 |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
| 8. Compute Member Opening Balances (carried from previous cycle)      |
|    Compute Member Closing Balances via Master Balance Equation        |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
| 9. ASSERT BALANCE INVARIANT:                                          |
|    SUM(closing_balance) == SUM(opening_balance) + Charges - Payments  |
|    If Assertion Fails: ROLLBACK TRANSACTION & THROW ERROR             |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
| 10. Write Immutable Ledger Entries & Statement Rows                   |
|     Update Cycle Status -> CLOSED, set closedAt & closedById          |
+-----------------------------------------------------------------------+
```

---

## 8. Edge Cases & Exception Handling

1. **Zero Man-Days with Grocery Bills Present:**
   * If $M = 0$ (all mess members absent all month) and $G > 0$, division by zero is prevented. Cycle close is blocked with error `BAD_REQUEST: Cannot calculate mess rate for zero man-days with non-zero groceries.`
2. **Indivisible Rounding Residue:**
   * Largest-remainder algorithm handles residue distribution to individual member lines. Any structural system-level fraction is logged to a single `ROUNDING_ADJUSTMENT` ledger entry tied to the system member account.
3. **Mid-Cycle Join and Leave:**
   * Handled gracefully via `prorate_rent = true` on membership and exact day counting for active membership date intervals.
4. **Mid-Month Cook Change:**
   * If Arun is cook Sept 1–15 and Bilal is cook Sept 16–30, total cook credit pool is split 50/50 between Arun and Bilal based on their active cook date ranges.
5. **Late Grocery Bills Submitted After Cycle Close:**
   * Cannot be added to a `CLOSED` cycle. The bill is posted to the current `OPEN` cycle with an explicit reference note (`original_expense_date`).
6. **Cook Self-Approval Guard:**
   * If an Admin user is also marked as a Cook on a Mess membership, the `CookSelfApprovalGuard` blocks them from approving any `GROCERY` expense where `submittedById == currentUserId`.
7. **Advance Payment & Negative Balances:**
   * Members paying multiple months in advance transition to a negative closing balance (credit). This balance carries forward unchanged as `opening_balance` for the next cycle.

---

## 9. Test Plan

### 9.1 Shared Money Utility Unit Tests (`/shared/tests`)
* Exact fils arithmetic (addition, subtraction, multiplication, integer division).
* Largest-remainder algorithm verification (e.g., dividing 10,001 fils among 3 members -> 3334, 3334, 3333, sum = 10001).
* Verification of zero floating-point reliance.

### 9.2 Guards & Authorization Unit/Integration Tests (`/api/test/guards`)
* `CookSelfApprovalGuard`: Reject cook approving own grocery expense.
* `AdminGuard`: Reject non-admin accessing management endpoints.
* `MembershipGuard`: Reject non-mess member logging absence.

### 9.3 End-to-End Acceptance Benchmark Test (`/api/test/e2e/acceptance.e2e-spec.ts`)
Executes the mandatory benchmark scenario:
* **Cycle:** September (30 days). Room 1 beds @ 750 AED (75,000 fils), Room 2 beds @ 650 AED (65,000 fils).
* **Members:**
  * **Arun:** Room 1, Mess, Cook. Consumed 30 days. Fronted AED 2,400.00 groceries (240,000 fils). Water taken: 7.
  * **Bilal:** Room 1, Mess. Consumed 28 days. Fronted AED 45.00 washing powder (4,500 fils, ALL_ROOM). Water taken: 7.
  * **Chen:** Room 2, Mess. Consumed 30 days. Water taken: 6.
  * **Dev:** Mess only. Consumed 12 days. Water taken: 0.
* **Inputs:**
  * Groceries: 240,000 fils (Arun)
  * Cook charge: 5,000 fils per mess member (Pool = 20,000 fils, credited to Arun)
  * Water: 20 bottles @ 700 fils = 14,000 fils (BY_CONSUMPTION: Arun 7, Bilal 7, Chen 6)
  * Water heater: 30,000 fils (SINGLE_ROOM Room 1 -> Arun 15,000 fils, Bilal 15,000 fils)
  * Washing powder: 4,500 fils (Bilal) (ALL_ROOM -> Arun 1,500 fils, Bilal 1,500 fils, Chen 1,500 fils)
* **Assertions:**
  * Total Man-Days == 100.
  * Daily Rate == 2,400 fils (24.00 AED).
  * Net Closing Balances:
    * Arun: **-86,600 fils** (-866.00 AED)
    * Bilal: **+164,100 fils** (+1,641.00 AED)
    * Chen: **+147,700 fils** (+1,477.00 AED)
    * Dev: **+33,800 fils** (+338.00 AED)
  * Total Charges across all members == **523,500 fils** (5,235.00 AED = Rent 215,000 + Groceries 240,000 + Cook 20,000 + Water 14,000 + Heater 30,000 + Powder 4,500).
