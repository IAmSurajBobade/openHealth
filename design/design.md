# Architecture & Design Document: **openHealth**

This document outlines the high-level architecture, tech stack, and data models of the `openHealth` application to aid LLMs and developers in understanding the codebase for feature additions, bug fixes, and refactoring.

## 1. High-Level Architecture
**Type**: Single Page Application (SPA) / Progressive Web App (PWA)
**Approach**: Offline-first, Local-storage primarily (No backend dependency for core features currently).

The application is built around a React frontend and relies heavily on browser-native `IndexedDB` for data persistence. It allows users to track patients, manage different types of health tests, and log readings locally.

## 2. Tech Stack Ecosystem
- **Core**: React 19, TypeScript
- **Build Tool**: Vite (`vite-plugin-pwa` for PWA features)
- **Routing**: `react-router-dom` v7+
- **Styling**: Tailwind CSS, Vanilla CSS (`index.css`), `lucide-react` (icons)
- **Database / Storage**: `idb` wrapper around native `IndexedDB`
- **Internationalization (i18n)**: `react-i18next`
- **Cryptography**: Web Crypto API (`src/services/crypto.ts` stubbed for future secure syncing)

## 3. Directory Structure
```
src/
├── assets/          # Static assets
├── components/      # Reusable UI components
│   └── ui/          # Generic UI building blocks
├── data/            # Seed data (e.g., default tests)
├── locales/         # i18n translation strings
├── models/          # Complex domain models (if applicable)
├── pages/           # High-level route components (Dashboard, PatientDetail, etc.)
├── services/        # Business logic, DB operations, and external services.
│   ├── db.ts        # IndexedDB operations
│   └── crypto.ts    # Web Crypto API methods
├── types.ts         # Global TypeScript interfaces
└── App.tsx          # Main application router
```

## 4. Data Models (`src/types.ts`)
The application operates on four primary entities stored in IndexedDB:

1. **`Patient`**: Represents a tracked individual (Member).
   - Fields: `id`, `name`, `age`
2. **`TestReference`**: Master records defining a specific health test.
   - Fields: `id`, `testName`, `category`, `unit`, `defaultIdealMin`, `defaultIdealMax`
3. **`TestReading`**: A single timestamped test result for a `Patient`.
   - Fields: `id`, `patientId`, `testName`, `date` (ISO String), `value`, `idealMin`, `idealMax`, `unit`, `notes`, `reason`
4. **`UserPreferences`**: App configuration and sorting habits.
   - Fields: `sortMembersBy`, `filterMembersQuery`, `sortTestsBy`, null/empty configs.

## 5. Storage Layer (`src/services/db.ts`)
- Database Name: `HealthTrackerDB`
- Tables (Object Stores): `patients`, `readings`, `testReferences`, `preferences`.
- Indexed by:
  - `readings`: `by-patientId`, `by-testName`, `by-date`
  - `testReferences`: `by-testName`
- Capabilities: Includes functions for CRUD operations, bulk saving, and importing/exporting entire user profiles as JSON.

## 6. Key Workflows / LLM Guidance
- **Adding a Feature**:
  1. Update `src/types.ts` if data models change.
  2. Map DB upgrades in `db.ts` (increment `DB_VERSION` and add logic in `upgrade` hook).
  3. Create/Modify generic UI components in `src/components/ui/`.
  4. Build page logic in `src/pages/`.
  5. Use hooks for DB operations.
- **Styling**: Stick to Tailwind CSS utility classes. Update `index.css` only for global CSS variables or root adjustments.
- **State**: The app heavily relies on fetching from DB via promises. State is locally managed within components using standard React hooks (`useState`, `useEffect`).
- **Icons**: Always import from `lucide-react`.

## 7. Future Considerations
- **Sync/API**: `crypto.ts` exposes `encryptPayload` and `decryptPayload`, preparing the application for End-to-End Encrypted (E2EE) cloud syncing capabilities.
