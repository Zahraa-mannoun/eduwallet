# EduWallet

**EduWallet: A Multi-Module Digital Wallet with Parental Control and Education Funding for Students in Crisis Economies**
*A Case Study of Lebanon*

> Master's Thesis Project Lebanese University, Faculty of Economics and Business Administration, Business Computer Science Program

---

## Overview

Since Lebanon's banking crisis, apps like Whish and OMT have made it easy to move money: families abroad can send funds and students can pay digitally. What these apps don't solve is **what happens after the money arrives**. Once a parent sends money or an institution grants a scholarship, there is no visibility into how it is spent, no way to set limits by purpose, and no guarantee that education funds are actually used for education.

EduWallet addresses that gap. It is a student wallet built around **control and accountability**:

- **Parents** set monthly budgets per category, approve exceptional expenses, and monitor spending in real time.
- **Institutions** disburse scholarships into education-locked categories, so funds can only be spent on their intended purpose.
- **Receipt verification** checks that purchases match the category they were paid from.
- **Students** keep autonomy for routine, in-budget spending.

EduWallet complements existing money-transfer apps rather than replacing them: a service like Whish could serve as the way money enters the wallet.

This is a **demonstration system**. No real money is processed.

---

## Key Features

### Digital Wallet
- USD-denominated wallet per user
- Admin tops up Parent and Institution wallets; funds reach students through parental transfers and scholarship disbursements
- Atomic monthly budget rollover with per-category snapshots (`LockedFundHistory`)

### Budget Manager & Parental Controls
- Parents set monthly spending limits per category: Tuition, Books, Food, Transport, Software, Rent, Lifestyle, and General
- In-budget purchases are auto-approved; anything outside the budget waits for parent approval


### Education Funding / Scholarship Disbursement
- Institutions disburse scholarships directly into student wallets
- Scholarship funds are locked to education categories and can only be spent there

### Virtual Cards
- Virtual cards created per spending category, with limits enforced by the backend
- After use: auto-renew ON → the card is replaced; auto-renew OFF → the card is frozen and the student can unfreeze it manually

### Payments & Transfers
- **EduMart** demo online store paid with EduWallet virtual cards
- **ScanMart** demo shop where the purchase category is detected from receipt keywords
- **Transfers**  money transfers between wallets

### Cash Withdrawals & Personal Savings
- Students withdraw cash in person through an agent
- Personal savings withdrawals need a student request and parent approval before the agent can dispense them

### Receipt Verification (OCR)
- Tesseract.js with a persistent worker and fuzzy matching (threshold 0.75)
- Receipts classified as `AUTO_VERIFIED`, `PENDING`, or `FLAGGED` based on merchant matching and category comparison

### Fraud Detection
- Rules stored in a `FraudRule` database table (not hardcoded), cached in Redis with a 60-second TTL
- Configurable from the admin dashboard without a redeploy

### Financial Insights
- Rule-based spending analysis (not AI/ML) with budget summaries and category breakdowns

### Reports & Real-Time Updates
- Downloadable PDF financial reports
- Live updates across all apps via Socket.io

---

## User Roles

| Role | Description |
|------|-------------|
| **Student** | Spends within budgets, requests approvals, uploads receipts, views insights |
| **Parent/Guardian** | Funds the student, sets category budgets, approves exceptions, monitors activity |
| **Institution** | Disburses scholarships into education-locked categories |
| **Agent** | Processes in-person cash withdrawals only (not top-ups) |
| **Admin** | Manages users, KYC, fraud rules, rollover, and system configuration |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + TypeScript + Fastify |
| Web Apps | React + TypeScript + Vite + Tailwind CSS |
| Mobile App | React Native + TypeScript + Expo |
| Database | PostgreSQL 18 + Prisma ORM |
| Caching | Redis (sessions and fraud rules) |
| Real-Time | Socket.io |
| Auth | JWT + bcrypt |
| OCR | Tesseract.js (fuzzy matching, persistent worker) |
| Payment Engine | Custom simulated engine |

---

## Project Structure

An npm workspaces monorepo:

```
eduwallet/
├── backend/            # Fastify API server              (port 3000)
├── mobile/             # React Native + Expo app         (port 8081)
├── web/                # Admin dashboard                 (port 3001)
│   ├── edumart/        # EduMart demo online store       (port 3002)
│   ├── ocr-shop/       # ScanMart demo receipt shop      (port 3003)
│   └── agent/          # Agent cash withdrawal portal    (port 3004)
└── packages/
    └── shared/         # Shared types used across apps
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 18
- Redis

### 1. Clone and install

```bash
git clone https://github.com/Zahraa-mannoun/eduwallet.git
cd eduwallet
npm install
```

### 2. Set up environment variables

```bash
cd backend
cp .env.example .env
```

Then open `backend/.env` and fill in your own database URL and secrets.

### 3. Set up the database

```bash
npx prisma migrate dev
npx prisma db seed
cd ..
```

### 4. Run the apps

From the repository root, each in its own terminal:

```bash
npm run backend     # API              → http://localhost:3000
npm run web         # Admin dashboard  → http://localhost:3001
npm run edumart     # EduMart          → http://localhost:3002
npm run ocr-shop    # ScanMart         → http://localhost:3003
npm run agent       # Agent portal     → http://localhost:3004
npm run mobile      # Expo mobile app
```

### 5. (Optional) Open Prisma Studio

```bash
cd backend
npx prisma studio
# Opens at http://localhost:5555
```

---

## Architecture Highlights

**Atomic Budget Rollover**  The monthly rollover runs inside a single Prisma transaction. It resets `LockedFund` records per category and writes `LockedFundHistory` snapshots together, with a rollover gate flag to prevent double execution.

**Source-of-Truth Balances**  Balances are read directly from `LockedFund.amount` and `totalLocked`, not derived from ledger aggregation, so they stay correct under concurrent operations.

**Configurable Fraud Rules**  Fraud thresholds live in a `FraudRule` table instead of hardcoded logic, cached in Redis with a 60-second TTL, so admins can change them without a deployment.

**Signal-then-Refetch Real-Time Updates** After a transaction commits, the backend emits a Socket.io event; clients refetch from the REST API and re-render, keeping the database the single source of truth.

---

## Future Work

- Integration with money-transfer services (e.g. Whish, OMT) as funding sources
- Real merchant integrations for payments at physical and online shops
- Academic Credential Vault (SHA-256 document hashing + Ethereum Sepolia)
- Docker deployment configuration
- AWS S3 for file and receipt storage
- Twilio SMS for OTP and payment notifications
- Offline QR payments
- BullMQ job queues for rollover at scale

---

## About

Built as a master's thesis at **Lebanese University**, Faculty of Economics and Business Administration.

**Author:** Zahraa Mannoun  [zahraamannoun.com](https://zahraamannoun.com) · [GitHub](https://github.com/Zahraa-mannoun) · [LinkedIn](https://linkedin.com/in/zahraa-mannoun)

**Supervisor:** Dr. Mustafa Serji
