# Work Journal Module - UX Design & Integration Plan

## 1. Executive Summary
This document outlines the UX strategy for integrating the **Work Journal (Laporan Kerja)** into the existing T-Absensi system. The goal is to transform the "Clock Out" action from a purely administrative task into a valuable "End of Day" ritual that captures productivity data without adding friction.

**Core Philosophy**: "AI-Assisted, Not AI-Policed."

---

## 2. UX Flow Mapping

### 2.1 The "Wrap-Up" Ritual (Clock Out Flow)
This is the critical integration point. We intercept the standard clock-out action.

1.  **Trigger**: User clicks the big red **"Clock Out"** button on the Dashboard.
2.  **System Check**:
    *   *Condition*: Is duration > 1 hour?
    *   *If No*: Proceed to standard Clock Out (assume test or mistake).
    *   *If Yes*: Trigger **"End of Day Reflection" Modal**.
3.  **Step 1: The Prompt (Modal)**
    *   **Headline**: "Great work today, [Name]! You've logged [8h 15m]."
    *   **Input Area**: Large text area with placeholder: *"What did you accomplish today?"*
    *   **Quick Actions**:
        *   🎙️ **Voice Note**: Tap to speak (Mobile optimized).
        *   ✨ **Generate with AI**: Uses previous context (optional) or formatting.
        *   ⏩ **Skip for now**: "Just Clock Out" (Ghost button at bottom).
4.  **Step 2: Review (Draft)**
    *   User sees their input.
    *   **AI Polish**: Click "Refine" to turn "did fix login bug" into "Resolved critical authentication issue in Login Module."
    *   **Tags**: Auto-suggest "Development", "Meeting", etc.
5.  **Step 3: Completion**
    *   User clicks **"Save & Clock Out"**.
    *   System saves `attendance` record (Clock Out Time).
    *   System saves `work_journal` record linked to attendance.
    *   **Success Toast**: "Journal saved. Have a great evening!"

### 2.2 Mobile Journal Flow
*   **Strategy**: Voice-First.
*   **UI**: Bottom Sheet (Drawer) instead of Center Modal.
*   **Interaction**: Large "Hold to Record" button. Auto-transcribe upon release.

---

## 3. UI Component Specifications

### A. `JournalEntryModal` (New)
*   **Type**: Dialog / Sheet.
*   **Props**: `attendanceId`, `currentDuration`.
*   **State**: `draft` | `listening` | `refining` | `saved`.
*   **Elements**:
    *   **Time Banner**: "Total Session: 8h 12m" (Visual validation).
    *   **Editor**: Minimal rich text or plain text area.
    *   **AI Toolbar**: `[✨ Polish]`, `[📝 Summarize]`.
    *   **Voice Trigger**: Pulsing Icon (when active).

### B. `WorkInsightWidget` (Employee Dashboard)
*   **Location**: Below "Stats Cards", above "Attendance History".
*   **Content**:
    *   **Weekly Chart**: Privacy-friendly "Activity Volume" (Line chart).
    *   **AI Summary Card**: "This week you focused heavily on *Backend Optimization*."
    *   **Status Indicators**:
        *   🟢 Completed
        *   🟡 Pending (Clocked out but skipped journal)
        *   🔴 Missing

### C. `TeamPulseBoard` (Manager Dashboard)
*   **Focus**: Trends, not surveillance.
*   **View**: Grid of cards (one per employee).
*   **Indicators**:
    *   "Health Score": Based on log consistency (not hours).
    *   "Topic Cloud": What is the team working on? (e.g., "Bugfix", "Design", "Planning").
    *   **Anomaly Flag**: "High hours, Empty logs" (Needs check-in).

---

## 4. UX Copywriting (Microcopy)

| Context | Traditional Copy | **T-Absensi Friendly Copy** |
| :--- | :--- | :--- |
| **Modal Header** | Work Log | **Ready to wrap up?** |
| **Placeholder** | Enter description... | **What were your big wins today?** |
| **AI Button** | AI Writing | **✨ Make it professional** |
| **Skip Button** | Cancel | **Skip & Clock Out** |
| **Success** | Data Saved. | **All set. See you tomorrow!** |
| **Manager Alert** | Low Performance | **Needs Support / Review** |

---

## 5. Adoption Strategy & Risk Mitigation

### 5.1 The "Low Friction" Promise
*   **Risk**: Employees see this as extra paperwork.
*   **Mitigation**:
    1.  **AI Auto-Draft**: If they used the system (e.g., git commits, documents), we eventually want to pre-fill this. For now, **Voice-to-Text** is the bridge.
    2.  **Editing Window**: Allow editing the journal *after* clock out (until midnight). Don't force perfection at the door.

### 5.2 Psychological Safety
*   **Risk**: Fear of AI judgment.
*   **Mitigation**:
    *   **Private Mode**: "Your journals are private until you submit the Weekly Report." (Optional config).
    *   **Supportive AI**: The AI should *never* say "Bad job." It should say "Focus appeared scattered today – how can we help?"

### 5.3 Mobile Experience
*   **Requirement**: T-Absensi is heavily used on mobile.
*   **Decision**: The Journal Input **MUST** be usable with one thumb. The "Save" button must be at the bottom right.

---

## 6. Development Roadmap (UX Priority)

1.  **Phase 1 (The Hook)**: Implement the `JournalEntryModal` on Clock Out. Just text storage. No AI yet.
2.  **Phase 2 (The Helper)**: Connect OpenAI/Gemini for "Polishing" the text.
3.  **Phase 3 (The Insight)**: Build the Employee Dashboard graphs.
4.  **Phase 4 (The Manager)**: Build the Team Overview.

---

## 7. Next Steps for Developer
1.  **Scaffold**: Create `src/components/journal/JournalEntryModal.tsx`.
2.  **Integrate**: Import and trigger in `AbsensiKaryawan.tsx` inside `handleClockOut`.
3.  **Database**: Ensure `work_journals` table is ready (done in previous step).
