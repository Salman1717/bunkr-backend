# 🔐 Bunkr User Accounts Directory

All requested user accounts have been seeded into the PostgreSQL database.

---

## 🔑 Login Credentials Overview

> **Default Password for All New Accounts:** `password123`  
> **API URL:** `http://localhost:4000`  
> **Web App URL:** `http://localhost:3000`

---

## 📋 Complete Accounts Table

| # | Full Name | Email Address | Role / Admin Status | Database ID | Status |
|---|---|---|---|---|---|
| **1** | **Salman Mhaskar** | `salman@bunkr.com` | 👑 **Super Admin** | `bc777ef7-7ff3-443e-9fc2-3248ac48dda1` | 🟢 Active |
| **2** | **Farman Mhaskar** | `farman@bunkr.com` | Member | `435c4df8-ccbc-4062-9aff-9cf7df8adad1` | 🟢 Active |
| **3** | **Awatif** | `awatif@bunkr.com` | Member | `7cb5fd07-e1d6-4310-af67-15b0c3c755b2` | 🟢 Active |
| **4** | **Zeeshan Budye** | `zeeshan@bunkr.com` | Member | `597bfcc0-7a91-4452-818c-bf059d39157b` | 🟢 Active |
| **5** | **Faheem** | `faheem@bunkr.com` | Member | `a39c17ab-affc-42fc-9d11-30b005bcc4f6` | 🟢 Active |
| **6** | **Tabish Kazi** | `tabish@bunkr.com` | Member | `61113248-8ace-40e5-8757-be5ff3c0e26f` | 🟢 Active |
| **7** | **Adil Chilwan** | `adil@bunkr.com` | Member | `0d35e5db-c8e9-459b-885f-461c9c8240e3` | 🟢 Active |
| **8** | **Ruhan Sohail** | `ruhan@bunkr.com` | Member | `0f8d1693-3579-485b-8a12-093613922bd3` | 🟢 Active |
| **9** | **Arsalan** | `arsalan@bunkr.com` | Member | `d4cb4c74-e4d1-4bfc-a61b-00fc6781e90f` | 🟢 Active |
| **10** | **Rameez** | `rameez@bunkr.com` | Member | `80ecf5ab-1109-4019-8c6f-fa491eafe098` | 🟢 Active |

---

## 🛠️ Usage Instructions

### 1. Web Application Login
1. Open [http://localhost:3000](http://localhost:3000) in your browser.
2. Login with any of the emails above and password `password123`.
3. Admin permissions (Room creation, Section management, Member onboarding) are enabled for `salman@bunkr.com`.

### 2. API Authentication (`POST /api/auth/login`)
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "salman@bunkr.com",
    "password": "password123"
  }'
```
