# Work System (Work Journal) Module - Architecture & Feasibility Analysis

## 1. Executive Summary
Integrating a **Work Journal (Laporan Kerja)** module into the existing **T-Absensi** ecosystem is not only **feasible** but highly recommended. The current technology stack (Supabase + React/Vite) is perfectly suited for this expansion without the need for a separate microservice.

The synergy between **Attendance** (When you work) and **Journal** (What you do) provides the highest value when they are tightly coupled.

---

## 2. Architecture Recommendation
**Recommendation: Integrated Modular Monolith**

We should build this as a logically separate module *within* the current application and database, rather than a completely separate system.

### Why integrated?
1.  **Context Aware**: When an employee Clocks Out, the system can immediately prompt: *"You were here for 8 hours. What did you work on?"*
2.  **Shared Authentication**: No need to sync users or deal with complex SSO. `auth.users` remains the single source of truth.
3.  **Data Integrity**: You can easily query "Show me employees who were present but have no journal entry" using standard SQL Joins.
4.  **Cost Efficiency**: Leveraging the existing Supabase instance avoids doubling infrastructure costs.

### High-Level Tech Stack
-   **Database**: Supabase PostgreSQL (New tables linked to `public.attendance`).
-   **Backend**: Supabase Edge Functions (for AI processing and Reports).
-   **Frontend**: New Route `/work-journal` and Components in existing React App.
-   **AI**: OpenAI API or Gemini API connected via Edge Functions.

---

## 3. Database Schema Design (Proposed)

We need to add the following tables to the existing `public` schema:

### `projects` (Optional, for categorization)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `name` | text | Project name (e.g. "Website Redesign") |
| `status` | text | active/archived |

### `work_journals`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid | FK to `auth.users` |
| `attendance_id` | uuid | FK to `public.attendance` (Optional linkage) |
| `date` | date | The work date |
| `content` | text | Rich text description of work |
| `category` | text | e.g., "Dev", "Meeting", "Support" |
| `duration` | int | Minutes spent |
| `progress` | int | 0-100% |
| `status` | text | 'planned', 'in_progress', 'completed' |
| `ai_feedback` | jsonb | Stores AI suggestions/rating |

### `work_summaries` (AI Generated)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid | FK |
| `period_start` | date | Start of week/month |
| `period_end` | date | End of week/month |
| `summary` | text | AI generated text |
| `productivity_score` | int | AI estimation (0-100) |
| `anomalies` | text | "High hours, low output flagged" |

---

## 4. AI Assistant Integration Strategy

The AI features should be implemented as **Supabase Edge Functions**. We should not run AI logic on the client (browser) for security and consistency.

### Feature A: Journal Auto-Refinement
*   **Trigger**: User types a rough draft (e.g., "fixed login bug").
*   **Action**: User clicks "Enhance with AI".
*   **Backend**: Sends text to LLM -> Returns: "Investigated and resolved a critical authentication issue preventing user login..."
*   **UX**: The system replaces the text or offers a suggestion.

### Feature B: Manager Insights (The "Anomaly Detector")
*   **Trigger**: Scheduled Cron Job (Weekly).
*   **Logic**:
    1.  Fetch `attendance.work_hours` total.
    2.  Fetch `work_journals` entries.
    3.  Feed both to LLM context: *"Employee X worked 40 hours. Journals say: 'Meeting 2h'. Identify discrepancy."*
    4.  **Result**: Save to `work_summaries` table.

---

## 5. Risk Analysis

| Risk Category | Risk Description | Mitigation Strategy |
| :--- | :--- | :--- |
| **UX Friction** | Employees hate filling forms; adoption will be low. | **Make it frictionless**. Use Voice-to-Text. Pre-fill data if integrating with Git/Jira later. Trigger it right after Clock-Out. |
| **Privacy** | AI "Productivity Scoring" can feel dystopian/spying. | **Transparency**. Label AI clearly as an "Assistant" or "Coach", not a "Judge". Allow employees to see their own scores first before managers. |
| **Scalability** | Journal text data grows rapidly. | Text is cheap to store. Supabase handles millions of rows easily. Indexing on `date` and `user_id` is sufficient. |
| **Cost** | High usage of LLM APIs tokens. | Use cheaper models (e.g., GPT-4o-mini or Gemini Flash) for routine summaries. Only use heavy models for complex monthly reports. |

---

## 6. Implementation Stages (Roadmap)

### Phase 1: The Foundation (Current T-Absensi)
*   [x] Database Users & Auth
*   [x] Attendance Tracking (Clock In/Out)

### Phase 2: Manual Journaling (MVP)
*   [ ] Create `work_journals` table.
*   [ ] Create UI: "Input Activity" (Tag Project, Description, Hours).
*   [ ] Link Journal to Attendance: "You worked 8 hours, you have logged 6 hours of activity. 2 hours missing."
*   [ ] Basic Manager View: List of journals per employee.

### Phase 3: AI Integration
*   [ ] **Writer Assistant**: "Help me write this professionaly".
*   [ ] **Audio Journal**: Record voice message -> Whisper API -> Text Journal.
*   [ ] **Daily Recap**: AI summarizing the day's entries.

### Phase 4: Manager Intelligence
*   [ ] **Weekly Report Generation**: Auto-email PDF of team activities.
*   [ ] **Productivity Dashboard**: Charts combining attendance vs. output.
*   [ ] **Anomaly Alerts**: Push notification for meaningful discrepancies.

---

## 7. Conclusion
Integrating this into T-Absensi is the **correct strategic move**. It transforms the app from a simple "Time Tracker" (Administrative) into a "Performance Management System" (Strategic).

**Next Step**: Should we proceed with **Phase 2 (Database Schema & Basic UI)**?
