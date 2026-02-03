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
| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | gen_random_uuid() | Primary Key |
| `user_id` | uuid | - | FK to `auth.users`, identifying the author |
| `date` | date | now() | Date of the journal entry |
| `content` | text | - | The actual journal text/report |
| `duration` | int | 0 | Minutes spent (0 for manual entries) |
| `status` | text | 'completed' | General status of the entry task |
| `verification_status` | text | 'submitted' | **Workflow Status**: `draft`, `submitted`, `reviewed`, `approved`, `rejected` |
| `manager_notes` | text | - | Feedback provided by managers during review |
| `created_at` | timestamptz | now() | Timestamp of creation |

### Visibility Logic (RLS Policies)
1.  **View Policy**:
    *   `user_id = auth.uid()` (Employee sees own).
    *   OR `role IN ('manager', 'admin')` (Managers see all).
2.  **Update Policy**:
    *   Same as view; Managers can write to `manager_notes` and `verification_status`.

---

## 4. Workflow Stages

1.  **Drafting (`draft`)**:
    *   Employee writes journal.
    *   Visible **ONLY** to Employee.
    *   Can be saved and edited multiple times.

2.  **Submission (`submitted`)**:
    *   Employee clicks "Kirim".
    *   Status changes to `submitted`.
    *   **Instantly visible** on Manager & Admin dashboards.
    *   Badge: "Menunggu" (Pending).

3.  **Review (`approved` / `rejected`)**:
    *   Manager reviews the content.
    *   **Approve**: Status -> `approved`. Badge: "Disetujui".
    *   **Reject/Revise**: Status -> `rejected`. Badge: "Revisi". Manager adds notes explaining what needs fixing.

---

## 5. Future Roadmap (AI Integration)

### Phase 3: AI Augmentation (Next)
*   **Writer Assistant**: "Help me write this professionally".
*   **Work Summarization**: Auto-generate weekly summaries from daily headers.
*   **Anomaly Detection**: Flag mismatches between attendance hours and journal output.

---

## 6. Current Status
*   [x] **Database Schema**: Implemented.
*   [x] **RLS Policies**: Secure and role-aware.
*   [x] **Employee UI**: Create, Draft, Submit.
*   [x] **Manager UI**: Real-time Feed, Review (Approve/Reject), Feedback.
*   [x] **Admin UI**: Global Activity Feed.
*   [x] **Navigation**: Integrated into system sidebars.

The module is currently **LIVE** in the development environment.
