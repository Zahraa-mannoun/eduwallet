# EduWallet

**EduWallet: A Multi-Module Financial Access and Academic Credential Platform for Students in Crisis Economies**
*A Case Study of Lebanon*

> Master's Thesis Project  Lebanese University, Faculty of Economics and Business Administration, Business Computer Science Program

---

## Overview

Lebanese students face a banking system in collapse. They can't get international payment cards, can't pay for online courses or developer tools, can't receive scholarships easily, and can't pay university fees digitally. Parents abroad struggle to send money in a controlled, transparent way.

EduWallet is a fintech prototype that tackles this directly. It gives students a digital wallet with virtual card generation, category-locked budgets, parental oversight, and QR-code payments  all built without relying on the traditional banking system.

This is a **demonstration system**. No real money is processed.

---

## Key Features

### Digital Wallet
- USD-denominated wallet per user
- Admin tops up Parent and Institution wallets; funds flow to students through parental transfers
- Atomic monthly budget rollover with per-category snapshots (`LockedFundHistory`)

### Virtual Card System
- Single-use virtual cards generated per transaction
- Cards expire after use; each payment gets a fresh card with custom restrictions

### Budget Manager & Parental Controls
- Parents set monthly spending limits per category (Academic, Food, Rent, Transport, General)
- Real-time monitoring with auto-approval for routine purchases and approval queue for exceptions
- Emergency override flow for medical or urgent academic expenses

### Education Funding / Scholarship Disbursement
- Institutions can disburse scholarships directly into student wallets
- Funds are locked to education-specific categories until released

### Payment Methods
- **QR Code Payments**  via ScanMart for campus vendors and local merchants
- **Online Payments**  via EduMart for courses, software subscriptions, and online shopping
- **Peer-to-Peer Transfers**  bill splitting and group expense sharing between students

### Receipt Verification (OCR)
- Tesseract.js with fuzzy matching (threshold: 0.75) and a persistent worker for performance
- Receipts classified as `AUTO_VERIFIED`, `PENDING`, or `FLAGGED` based on merchant DB matching and category comparison

### Fraud Detection
- Rules stored in a `FraudRule` database table (not hardcoded) with Redis caching (60-second TTL)
- Fully configurable from the admin dashboard

### Academic Credential Vault
- Document hashing with SHA-256
- Ethereum Sepolia testnet integration is planned future work (currently mock transaction hash)

### Financial Insights Assistant
- Rule-based spending analysis (not AI/ML)
- Provides budget summaries and category breakdowns

### Real-Time Updates
- WebSocket transport via Socket.io across all interfaces

---

## User Roles

| Role | Description |
|------|-------------|
| **Student** | Primary wallet holder — makes payments, manages budget, views insights |
| **Parent/Guardian** | Funds accounts, sets spending rules, approves exceptions, monitors activity |
| **Institution** | Disburses scholarships and pays university fees |
| **Agent** | Processes cash withdrawals only (not top-ups) |
| **Admin** | Full platform control — user management, fraud rules, system configuration |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + TypeScript + Fastify |
| Web Admin Dashboard | React + TypeScript + Vite + Tailwind CSS |
| Mobile App | React Native + TypeScript + Expo |
| Database | PostgreSQL 18 + Prisma ORM |
| Caching | Redis (TTL-based, sessions and fraud rules) |
| Real-Time | Socket.io |
| Auth | JWT + bcrypt |
| OCR | Tesseract.js (fuzzy matching, persistent worker) |
| Payment Engine | Custom simulated engine (no Stripe) |

---

## Project Structure

The project is split into six workspaces:
---

## Getting Started
edu-wallet/
├── backend/ # Fastify API server (port 3000)
├── web-admin/ # React admin dashboard (port 3001)
├── edumart/ # Online merchant demo store (port 3002)
├── scanmart/ # QR/OCR merchant demo store (port 3003)
├── agent-portal/ # Agent cash withdrawal portal (port 3004)
└── mobile/ # React Native + Expo student app (port 8081)

### Prerequisites

- Node.js 18+
- PostgreSQL 18
- Redis
- Expo CLI (for mobile)

### 1. Clone the repository

```bash
git clone https://github.com/Zahraa-mannoun/eduwallet.git
cd eduwallet
```

### 2. Set up environment variables

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/eduwallet"
JWT_SECRET=your_jwt_secret
REDIS_URL=redis://localhost:6379
```

### 3. Set up the database

```bash
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
```

### 4. Start the backend

```bash
npm run dev
# Runs on http://localhost:3000
```

### 5. Start the web apps

Each web workspace runs independently:

```bash
# Admin dashboard
cd web-admin && npm install && npm run dev      # http://localhost:3001

# EduMart
cd edumart && npm install && npm run dev        # http://localhost:3002

# ScanMart
cd scanmart && npm install && npm run dev       # http://localhost:3003

# Agent Portal
cd agent-portal && npm install && npm run dev  # http://localhost:3004
```

### 6. Start the mobile app

```bash
cd mobile
npm install
npx expo start
```

### 7. (Optional) Open Prisma Studio

```bash
cd backend
npx prisma studio
# Opens at http://localhost:5555
```

---

## Architecture Highlights

**Atomic Budget Rollover**  The monthly rollover function is wrapped in a single outer Prisma transaction. It resets `LockedFund` records per category and writes `LockedFundHistory` snapshots atomically, with a rollover gate flag to prevent double-execution.

**Configurable Fraud Rules**  Fraud detection thresholds live in a `FraudRule` database table rather than hardcoded service logic. Rules are cached in Redis with a 60-second TTL, making them configurable by admins without a deployment.

**Source-of-Truth Balances**  Balance reads come directly from `LockedFund.amount` and `totalLocked`, not derived from ledger aggregation, ensuring correctness under concurrent operations.

**Receipt Intelligence**  Uploaded receipts are processed by a persistent Tesseract.js worker. Merchant name and category are matched against the database with fuzzy matching; unmatched receipts are flagged for manual review.

---

## Future Work

- Docker deployment configuration
- AWS S3 for file and receipt storage
- Twilio SMS for OTP and payment notifications
- Real offline QR payment sync
- Ethereum Sepolia testnet integration for the Academic Credential Vault
- BullMQ job queues for rollover at scale
- Real merchant integrations for payments at physical and online shops

---

## About

Built as a master's thesis at **Lebanese University**, Faculty of Economics and Business Administration.

**Author:** Zahraa Mannoun — [zahraamannoun.com](https://zahraamannoun.com) · [GitHub](https://github.com/Zahraa-mannoun) · [LinkedIn](https://linkedin.com/in/zahraa-mannoun)

**Supervisor:** Dr. Mustafa Serji
