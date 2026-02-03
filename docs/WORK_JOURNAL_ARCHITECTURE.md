# Integrated Work Journal System - Architecture Document
**Version 2.0** | Last Updated: 2026-02-03

---

## 1. Overview

The Integrated Work Journal module enables employees to document daily work activities with a built-in validation, correction, and approval workflow. Journals flow automatically to Managers for review and Admins for audit & export.

### Key Design Goals
- **Single Source of Truth**: All journals live in `public.work_journals` with denormalized relationship data for fast querying.
- **Real-Time Visibility**: Managers and Admins see submitted journals instantly via Supabase Realtime channels.
- **Auditable**: Every status change is logged in `journal_activity_log`.
- **Role-Based Access**: RLS policies enforce strict visibility and action permissions.

---

## 2. Roles & Permissions

| Role | View | Create | Edit | Delete | Approve/Revision |
|:-----|:-----|:-------|:-----|:-------|:-----------------|
| **EMPLOYEE** | Own journals (all statuses) | ✅ | Draft, Need_Revision | Draft, Submitted | ❌ |
| **MANAGER** | Team journals (non-draft) | ❌ | ❌ | ❌ | ✅ |
| **ADMIN** | All journals (non-draft) | ❌ | ❌ | ✅ (cleanup) | ❌ |

---

## 3. Status Flow (State Machine)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌─────────┐   submit    ┌───────────┐   approve   ┌────────┐  │
│   │  DRAFT  │ ──────────► │ SUBMITTED │ ──────────► │APPROVED│  │
│   └─────────┘             └───────────┘             └────────┘  │
│        │                        │                               │
│        │ (delete)               │ need_revision                 │
│        ▼                        ▼                               │
│   [DELETED]              ┌──────────────┐                       │
│                          │NEED_REVISION │◄─── (edit & resubmit) │
│                          └──────────────┘                       │
│                                 │                               │
│                                 │ resubmit                      │
│                                 ▼                               │
│                          ┌───────────┐                          │
│                          │ SUBMITTED │                          │
│                          └───────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### Status Definitions

| Status | Badge Color | Description |
|:-------|:------------|:------------|
| `draft` | Grey | Saved but not sent. Only author can see. |
| `submitted` | Blue | Sent to Manager. Awaiting approval. |
| `need_revision` | Orange | Manager requested changes. Notes required. |
| `approved` | Green | Manager verified. Final state. Read-only. |

---

## 4. Database Schema

### `public.work_journals`

| Column | Type | Description |
|:-------|:-----|:------------|
| `id` | UUID | Primary Key |
| `user_id` | UUID | Author (FK to auth.users) |
| `department` | TEXT | Snapshot of author's department |
| `manager_id` | UUID | Auto-assigned manager (FK to profiles) |
| `date` | DATE | Entry date |
| `content` | TEXT | Journal content |
| `duration` | INT | Time spent in minutes |
| `verification_status` | TEXT | `draft`, `submitted`, `need_revision`, `approved` |
| `manager_notes` | TEXT | Feedback from manager (required for revision) |
| `submitted_at` | TIMESTAMPTZ | When status changed to submitted |
| `approved_at` | TIMESTAMPTZ | When approved |
| `approved_by` | UUID | Manager who approved |
| `created_at` | TIMESTAMPTZ | Record creation time |
| `updated_at` | TIMESTAMPTZ | Last modification time |

### `public.journal_activity_log`

| Column | Type | Description |
|:-------|:-----|:------------|
| `id` | UUID | Primary Key |
| `journal_id` | UUID | FK to work_journals |
| `action` | TEXT | 'created', 'submitted', 'approved', 'revision_requested', 'edited' |
| `performed_by` | UUID | Who performed the action |
| `previous_status` | TEXT | Status before change |
| `new_status` | TEXT | Status after change |
| `notes` | TEXT | Attached notes (e.g., revision reason) |
| `created_at` | TIMESTAMPTZ | When action occurred |

---

## 5. Row-Level Security (RLS)

### SELECT Policy: `journal_select_policy`
```sql
user_id = auth.uid()  -- Author sees own
OR (has_role('admin') AND status != 'draft')  -- Admin sees all except drafts
OR (has_role('manager') AND status != 'draft' AND (manager_id = auth.uid() OR same_department))
```

### INSERT Policy: `journal_insert_policy`
```sql
user_id = auth.uid()  -- Only create for yourself
```

### UPDATE Policy: `journal_update_policy`
```sql
(user_id = auth.uid() AND status IN ('draft', 'need_revision'))  -- Author edits
OR has_role('admin')
OR has_role('manager')  -- Manager updates status/notes
```

### DELETE Policy: `journal_delete_policy`
```sql
(user_id = auth.uid() AND status IN ('draft', 'submitted'))  -- Author deletes
OR has_role('admin')  -- Admin cleanup
```

---

## 6. Automation (Triggers)

### On INSERT/UPDATE: `handle_journal_meta_updates`
- Fetches author's department from `profiles` and snapshots to `department`.
- Finds a manager in the same department and assigns to `manager_id`.
- Sets `submitted_at` when status becomes `submitted`.
- Sets `approved_at` and `approved_by` when status becomes `approved`.

### On STATUS CHANGE: `log_journal_status_change`
- Inserts a record into `journal_activity_log` with:
  - Action type (submitted, approved, revision_requested)
  - Previous and new status
  - Performer ID
  - Manager notes (if any)

---

## 7. Frontend UX Requirements

### Status Badge Colors
- **Draft**: `bg-slate-50 text-slate-500` (Grey outline)
- **Submitted**: `bg-blue-50 text-blue-700` (Blue)
- **Need Revision**: `bg-orange-50 text-orange-700` (Orange)
- **Approved**: `bg-green-50 text-green-700` (Green)

### Tab Filters (All Views)
1. **Semua** (All)
2. **Menunggu Approval** (Submitted)
3. **Perlu Revisi** (Need Revision)
4. **Disetujui** (Approved)
5. **Draft** (Employee only)

### Empty State
If no journals match the filter, display:
> "Tidak ada entri jurnal untuk filter ini."

### Real-Time Updates
All views subscribe to `postgres_changes` on `work_journals` to refresh automatically.

---

## 8. Data Flow Summary

### Employee Submits Journal
1. Employee writes content and clicks "Kirim".
2. `verification_status` → `submitted`, `submitted_at` → NOW().
3. Trigger assigns `department` and `manager_id`.
4. Activity log records action.
5. Manager dashboard updates via Realtime.

### Manager Requests Revision
1. Manager views pending journal and clicks "Minta Revisi".
2. Modal enforces mandatory notes.
3. `verification_status` → `need_revision`, `manager_notes` → [input].
4. Activity log records action.
5. Employee dashboard shows orange badge and notes.

### Manager Approves
1. Manager clicks "Setujui".
2. `verification_status` → `approved`, `approved_at` → NOW(), `approved_by` → manager.uid.
3. Activity log records action.
4. Journal locked (read-only).

---

## 9. Current Status

- [x] Database Schema (Enhanced)
- [x] Activity Logging
- [x] Auto-Assignment Trigger
- [x] RLS Policies (Optimized)
- [x] Employee UI (Create, Edit, Delete, Filter)
- [x] Manager UI (Review, Approve, Revision)
- [x] Admin UI (Global Read, Export Ready)
- [x] Status Color Standardization
- [x] Tab-Based Filtering

---

## 10. Migration Files

| File | Purpose |
|:-----|:--------|
| `20260203_create_work_journals_table.sql` | Initial table creation |
| `20260204_journal_improvements.sql` | Schema enhancements & backfill |
| `20260204_integrated_journal_system.sql` | Complete system with activity log |

**To apply**: Run `20260204_integrated_journal_system.sql` in Supabase SQL Editor.
