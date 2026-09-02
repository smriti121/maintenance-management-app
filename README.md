# 🛠️ FixFlow — AI-Powered Maintenance Management Mobile Application

> An intelligent, end-to-end facilities and maintenance management mobile application built with **Expo (React Native)**, **TypeScript**, **Supabase**, and **Google Gemini AI**.

🔗 **Companion Admin Web Portal**: [FixFlow Facility Admin Dashboard](https://github.com/smriti121/maintenance-admin-dashboard)

---

## 🌟 Key Highlights & Core Features

### 1. 🎨 Modern Grey + Yellow Industrial Design
- High-contrast, accessibility-first theme (`#111111` / `#202020` / `#262626` / `#F5C400`).
- Fully responsive across Android phones, tablets, and web.

### 2. 🌐 Bilingual Localization (English & Hindi)
- Seamless dynamic language switching between **English** and **हिन्दी (Hindi)** with full dictionary translations and persistent AsyncStorage preferences.

### 3. 🏷️ QR Code Asset Identification & Registry
- Instant equipment lookup by scanning physical QR tags on ACs, Fans, Heaters, and electrical units.
- Auto-populates equipment specifications, location, model number, and past maintenance history into request tickets.
- Printable facility QR asset directory sheet.

### 4. 🔐 Role-Based Access Control (RBAC) & Authentication
- Dual-role support: **Resident / User** vs. **Maintenance Staff**.
- Secure authentication powered by Supabase Auth with persistent session storage.
- Intelligent initial routing based on account role.

### 5. ⚡ Automatic Workload-Based Assignment Engine
- When a resident reports a broken fan, faucet, AC, or appliance:
  1. The system queries all registered **Maintenance Staff**.
  2. Calculates real-time active workload (`pending`, `assigned`, `in_progress`).
  3. Automatically assigns the ticket to the **least-busy technician**.
  4. Records an automatic audit milestone in the activity timeline.

### 6. ✨ AI-Powered Smart Triage & Assistants
- **AI Smart Triage**: Analyzes issue title and description to predict category (Electrical, Plumbing, HVAC, etc.), recommend priority, estimate cost range, and display instant safety precautions.
- **AI Technician Completion Summary Generator**: Automatically synthesizes work performed, replacement parts, labor time, and costs into a professional technical sign-off summary with 1 tap.

### 7. 📸 Before & After Photo Evidence
- Multi-photo upload for residents reporting damage.
- Categorized photo tracking for technicians (`Before Repair` vs `After / Completion`).
- Fullscreen zoom preview for audit verification.

### 8. ⏱️ Time Logging & Cost / Warranty Tracking
- Accurate duration tracking (minutes worked per session) with work descriptions.
- Total labor hours aggregation.
- Financial breakdown: Estimated Cost vs. Actual Cost in ₹ INR.
- Asset warranty status (`Under Warranty`, `Out of Warranty`, `N/A`), purchase records, and replacement part itemization.

### 9. 📄 Automated PDF Audit Report Generation
- Exports a complete, branded **Maintenance Service & Audit Report** containing:
  - Official Job Ref and timestamps.
  - Stakeholder details (Resident & Assigned Technician).
  - Issue description and financial/warranty breakdown.
  - Initial, before-repair, and after-repair photo galleries.
  - Resolution and technical completion summary.
  - Complete chronological timeline and audit trail.
- Shareable directly via device sheet or browser print dialog (`expo-print` + `expo-sharing`).

---

## 🏗️ Architecture & Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Mobile Framework** | Expo SDK 54, React Native 0.81, React 19 |
| **Routing & Navigation** | Expo Router (Typed File-Based Routing) |
| **Language & i18n** | TypeScript, Custom Bilingual Context (EN / HI) |
| **Backend & Storage** | Supabase (PostgreSQL, Row-Level Security, Storage Buckets) |
| **AI Integration** | Google Gemini API + Heuristic Fallback Engine |
| **Hardware & Scanning** | `expo-camera`, `react-native-qrcode-svg` |
| **Document Export** | `expo-print`, `expo-sharing` |
| **Media & Animations** | `expo-image-picker`, `expo-image`, `react-native-reanimated` |

---

## 📁 Project Structure

```
maintenance-management-app/
├── assets/                    # Static images, icons, and badges
├── supabase-schema.sql        # Complete PostgreSQL table & RLS schema
├── src/
│   ├── app/                   # Expo Router routes
│   │   ├── _layout.tsx        # Root Stack navigator
│   │   ├── index.tsx          # Sign In & Sign Up with Role Selection
│   │   ├── user/
│   │   │   ├── dashboard.tsx  # Resident dashboard (metrics, active requests list)
│   │   │   ├── create-request.tsx # New request form with AI Smart Triage
│   │   │   └── request-detail.tsx # User detail view, timeline, photos, PDF export
│   │   └── staff/
│   │       ├── dashboard.tsx  # Technician dashboard with workload queue
│   │       └── task-detail.tsx # Work hub: status, notes, time logs, AI summary, PDF
│   ├── components/            # Reusable UI components
│   │   ├── status-badge.tsx   # Color-coded status & priority chips
│   │   ├── timeline-view.tsx  # Step-by-step visual audit trail
│   │   ├── themed-text.tsx    # Typography tokens
│   │   └── themed-view.tsx    # Styled container tokens
│   ├── constants/             # Design theme, colors, typography, spacing
│   ├── hooks/                 # Custom theme and color scheme hooks
│   ├── lib/
│   │   └── supabase.ts        # Supabase client configuration
│   ├── services/
│   │   ├── maintenance-service.ts # Workload auto-assignment, queries, CRUD
│   │   ├── ai-service.ts      # Gemini AI triage & summary generator
│   │   └── pdf-service.ts     # HTML template and PDF export engine
│   └── types/
│       └── maintenance.ts     # TypeScript data contracts
├── package.json
└── tsconfig.json
```

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd maintenance-management-app
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-api-key # Optional: for online Gemini AI
```

### 3. Supabase Database Setup
1. Open your **Supabase Project Dashboard** &rarr; **SQL Editor**.
2. Run the script provided in [`supabase-schema.sql`](./supabase-schema.sql).
3. Go to **Storage** &rarr; Create a bucket named `maintenance-photos` (Public).

### 4. Run the Development Server
```bash
# Start Expo bundler
npx expo start

# Run on Android emulator / device
npx expo start --android

# Run on iOS simulator
npx expo start --ios

# Run on Web browser
npx expo start --web
```

---

## 🔄 End-to-End Workflow Demonstration

1. **Sign Up**:
   - Register a **Maintenance Staff** account (e.g. `technician@app.com`).
   - Register a **Resident / User** account (e.g. `resident@app.com`).
2. **Submit a Request with AI**:
   - As the resident, enter "Broken Ceiling Fan" and description.
   - Tap **"✨ AI Smart Triage"** to view AI damage prediction, safety advice, and auto-set priority.
   - Attach photos and submit.
   - The ticket is **automatically assigned to the least-busy technician**.
3. **Technician Resolution**:
   - As the staff member, open the assigned task from the workload queue.
   - Update status to `In Progress`, add technician notes, upload a `Before-Repair` photo.
   - Tap **"⏱️ Log Time"** to record 45 minutes of repair work.
   - Input replacement parts (e.g. "Replaced 45uF Capacitor") and actual cost.
   - Tap **"✨ AI Generate Summary"** to auto-write the audit completion description.
   - Upload an `After / Completion` photo and resolve the task.
4. **Export Audit PDF**:
   - Either party can tap **"📄 Download Official Audit PDF"** to generate and share the PDF report with full photo evidence and audit timeline.
