# Software Requirements Specification (SRS) (ISO 9001:2015 Clause 8.3.3)

**Project:** Ospital ng Makati KPI Dashboard  
**Version:** 1.5  

---

## 1. Introduction
This document defines the requirements for the KPI Dashboard, a tool designed to visualize section performance, track submission compliance, and analyze trends over time.

## 2. Functional Requirements

### 2.1 User Roles & Access
*   **Viewer (Public/Guest):**
    *   Can view all charts, heatmaps, and records.
    *   Cannot add, edit, or delete data.
*   **Admin (QA/Authorized Users):**
    *   Access via password (`osmak123`).
    *   Can Add, Edit, and Delete KPI records.
    *   Can perform Batch Data Entry.

### 2.2 Dashboard Views
*   **KPI Trend:**
    *   Must display Composed Charts (Bars for Actual, Line for Target).
    *   Must show "Executive Widgets" (Success Rate Gauge, Failure Streak).
    *   Must allow filtering by Section, KPI, Department, and Date Range.
    *   Must calculate Variance automatically in tooltips.
*   **Top Performers:**
    *   Must categorize sections: Top Performer, Stable, Needs Improvement, Critical.
    *   Must provide a "Drill-down" view with a Monthly Heatmap matrix.
*   **Records:**
    *   Must display a paginated/scrollable table of all data.
    *   Must show visual progress bars for "Actual %".
    *   Must allow export to CSV.
*   **Non-Submission:**
    *   Must identify records submitted past their Due Date.
    *   Must calculate "Days Late".

### 2.3 Data Logic & Calculations
*   **Conformance Logic:**
    *   **Standard:** Actual >= Target is Conformant (e.g., Satisfaction Rate).
    *   **Inverted:** Actual <= Target is Conformant (e.g., Turnaround Time, Infection Rate).
*   **Batch Entry:**
    *   System must allow adding multiple rows in a spreadsheet-like interface.
    *   System must auto-fill KPI Definitions (Target, Unit) when a KPI is selected.

### 2.4 Performance & Architecture
*   **Backend:** Google Sheets via Google Apps Script (Web App).
*   **Caching:** The system must cache data in LocalStorage for 5 minutes to prevent redundant network requests and ensure UI responsiveness.
*   **Responsiveness:** UI must adapt to Desktop and Tablet screens.

## 3. Data Integrity & Security
*   **Validation:** System must prevent submission of records without Section or KPI Name.
*   **Backup:** Data is stored in Google Sheets, leveraging Google's native version history and backup features.

---
**Verified By:** Max Angelo G. Terrenal (Project Lead)  
**Date:** _________________________