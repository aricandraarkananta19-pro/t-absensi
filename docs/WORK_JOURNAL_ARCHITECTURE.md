# Work System (Work Journal) Module - Architecture & Feasibility Analysis

## 1. Executive Summary
The **Work Journal (Laporan Kerja)** module has been successfully integrated into the **T-Absensi** ecosystem as a core feature. It transforms the system from a tracking tool into a performance management platform.

The system now seamlessly links **Attendance** (presence) with **Journals** (productivity), offering real-time visibility for Managers and Admins.

---

## 2. Architecture & Implementation
**Approach: Integrated Modular Monolith**

The module is built directly within the existing Supabase + React infrastructure, ensuring tight integration and security.

### Key Components
-   **Database**: Supabase PostgreSQL (`work_journals` table).
-   **Role-Based Access Control (RLS)**:
    -   **Employees**: View/Update OWN journals only.
    -   **Managers**: View/Update ALL team journals (except Drafts). Review, Approve, Reject flow.
    -   **Admins**: Global visibility for audits and reporting.
-   **Real-time**: Supabase Realtime subscriptions ensure dashboards update instantly upon submission.

---

## 3. Database Schema (Final Implementation)

The schema relies on `work_journals` joined with `auth.users` through `public.profiles`.

### `work_journals`
### Database Schema
**Table**: `work_journals`

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | gen_random_uuid() | Primary Key |
| `user_id` | uuid | - | FK to `auth.users`, identifying the author |
| `department` | text | - | **Snapshot** of author's department at time of submission |
| `manager_id` | uuid | - | FK to `profiles`, auto-assigned based on Dept Manager |
| `date` | date | now() | Date of the journal entry |
| `content` | text | - | The actual journal text/report |
| `duration` | int | 0 | Minutes spent (0 for manual entries) |
| `verification_status` | text | 'submitted' | `draft`, `submitted`, `reviewed`, `approved`, `rejected` |
| `submitted_at` | timestamptz | - | Timestamp when status changed to 'submitted' |
| `manager_notes` | text | - | Feedback provided by managers during review |
| `created_at` | timestamptz | now() | Timestamp of creation |

### Automation & Security
1.  **Auto-Assignment Trigger**:
    -   On `INSERT/UPDATE`: Fetches Author's `department` from Profiles.
    -   Sets `manager_id` by finding a user with role 'manager' in that department.
    -   Sets `submitted_at = NOW()` when status becomes `submitted`.
2.  **Row Level Security (RLS)**:
    -   **Admin**: View `true` (All).
    -   **Manager**: View if `manager_id = auth.uid()` OR `department = <Manager's Dept>`.
    -   **Employee**: View if `user_id = auth.uid()`.

---

## 4. Workflow & Rules

### Status Lifecycle
The journal entry moves through the following strict states:

1.  **Draft (`draft`)**:
    -   Created by Employee.
    -   Visible **ONLY** to Employee.
    -   **Editable**: YES.
    -   **Deletable**: YES.

2.  **Sent/Pending (`submitted`)**:
    -   Employee submits Draft.
    -   Visible to Manager & Admin.
    -   **Editable**: NO (Locked).
    -   **Deletable**: NO.

3.  **Needs Revision (`rejected`)**:
    -   Manager requests changes.
    -   **Manager Notes**: STRICTLY REQUIRED.
    -   Status indicates "Perlu Revisi".
    -   **Editable**: YES (Employee updates and re-submits).
    -   **Deletable**: NO.

4.  **Verified (`approved`)**:
    -   Manager approves the entry.
    -   Final state.
    -   Badge: "Disetujui".
    -   **Editable**: NO.
    -   **Deletable**: NO.

### Implementation Rules
-   **Delete Constraint**: Delete button is conditionally rendered only when `status === 'draft'`.
-   **Edit Constraint**: Edit button is conditionally rendered only when `status === 'draft'` OR `status === 'rejected'`.
-   **Revision Loop**:
    -   Manager clicks "Revisi" -> Modal opens -> Notes input is Mandatory.
    -   Employee sees "Revisi" badge and Manager Notes on dashboard.
    -   Employee edits content -> Clicks "Kirim Ulang" -> Status changes back to `submitted`.
-   **Audit**: Manager notes are preserved until overwritten or resolved (implementation choice).

---

## 5. Future Roadmap (AI Integration)

### Phase 3: AI Augmentation (Next)
*   **Writer Assistant**: "Help me write this professionally".
*   **Work Summarization**: Auto-generate weekly summaries from daily headers.
*   **Anomaly Detection**: Flag mismatches between attendance hours and journal output.

---

## 6. Automated Features

### Auto Clock Out
-   **Purpose**: Closes attendance sessions for employees who forget to clock out.
-   **Mechanism**: Database Cron Job (`pg_cron`).
-   **Schedule**: Runs daily at **23:30 (UTC/Server Time)**.
-   **Logic**:
    -   Targets `attendance` rows where `clock_out` is `NULL` AND `date` is Today.
    -   Sets `clock_out` to **17:30** (5:30 PM) of that day.
    -   Appends note: `[System]: Auto Clock-Out (Lupa Absensi)`.
-   **Function**: `public.auto_clock_out_forgotten_entries()`.

## 7. Performance & Optimization
-   **Indexes**: Added on `user_id`, `date`, `department`, `verification_status`.
-   **RLS**: Optimized to avoid heavy joins via snapshot columns.

## 8. Current Status
*   [x] **Database Schema**: Implemented.
*   [x] **RLS Policies**: Secure and role-aware.
*   [x] **Employee UI**: Create, Draft, Submit.
*   [x] **Manager UI**: Real-time Feed, Review (Approve/Reject), Feedback.
*   [x] **Admin UI**: Global Activity Feed.
*   [x] **Navigation**: Integrated into system sidebars.
*   [x] **Auto Clock Out**: SQL Function & Cron Job prepared.

The module is currently **LIVE** in the development environment.
