# Bunkr — Backend API

**Bunkr** is a shared-accommodation billing system backend API designed for a household in Dubai where members rent beds, eat at the mess, or both.

---

## Technical Stack & Standards

- **Runtime & Framework:** Node.js 20+, TypeScript, NestJS
- **Database & ORM:** PostgreSQL 16+ via Docker Compose, Prisma ORM
- **Precision Financial Math:** 64-bit integer (`bigint`) **fils** standard (`1 AED = 100 fils`). Strictly **0 floating-point arithmetic** for money.
- **Rounding Engine:** Largest-Remainder Method (Hamilton-Hare distribution)
- **Authentication & AuthZ:** JWT (15-minute access token, 30-day rotating refresh token), NestJS Role & Permission Guards
- **Documentation:** OpenAPI Swagger served at `/api/docs`
- **Testing:** Jest / Supertest

---

## Directory Structure

```
├── REQUIREMENTS.md         # Full requirements, domain glossary, formulas, & API contracts
├── AGENTS.md               # Codebase conventions and engineering standards
├── docker-compose.yml      # Local PostgreSQL container specification
├── prisma/
│   ├── schema.prisma       # Prisma relational schema
│   └── seed.ts             # Benchmark seed script (September 30-day scenario)
├── shared/                 # Pure TypeScript money math utilities & shared types
│   └── money/
│       ├── fils.ts         # Exact integer fils arithmetic & Largest-Remainder algorithm
│       └── fils.spec.ts    # Money math unit tests
├── api/                    # NestJS application backend
│   ├── src/
│   │   ├── common/         # Guards (Admin, CookOrAdmin, CookSelfApproval), Interceptors, Decorators
│   │   ├── modules/        # Auth, Members, Rooms, Settings, Cycles, Absences, Water, Expenses, Adjustments, Payments, Billing, Statements
│   │   └── main.ts         # Application entrypoint
│   └── test/               # Integration & E2E Acceptance test suite
├── web/                    # [Placeholder] Empty client directory
└── mobile/                 # [Placeholder] Empty mobile client directory
```

---

## Getting Started

### 1. Prerequisites
- Node.js 20+
- Docker & Docker Compose
- npm

### 2. Launch Local PostgreSQL Database
```bash
docker-compose up -d
```

### 3. Apply Database Migrations & Generate Prisma Client
```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Seed Database (September Benchmark Scenario)
```bash
npm run prisma:seed
```

### 5. Start Development API Server
```bash
npm run start:dev
```
- API Server: `http://localhost:3000`
- OpenAPI Swagger Docs: `http://localhost:3000/api/docs`

---

## Test Suite Execution

### 1. Shared Money Math Unit Tests
```bash
npm run test:shared
```

### 2. End-to-End Primary Acceptance Benchmark Test
```bash
npm run test:e2e
```

---

## September Benchmark Test Results Summary

- **Man-Days:** 100 man-days (Arun 30, Bilal 28, Chen 30, Dev 12)
- **Daily Mess Rate:** 24.00 AED (`2,400 fils`)
- **Net Closing Balances:**
  - **Arun:** `-866.00 AED` (`-86,600 fils`)
  - **Bilal:** `+1,641.00 AED` (`+164,100 fils`)
  - **Chen:** `+1,477.00 AED` (`+147,700 fils`)
  - **Dev:** `+338.00 AED` (`+33,800 fils`)
- **Total Charges across Household:** `5,235.00 AED` (`523,500 fils`)
