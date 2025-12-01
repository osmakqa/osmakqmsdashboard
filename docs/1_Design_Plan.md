# Design and Development Plan (ISO 9001:2015 Clause 8.3.2)

**Project Title:** Ospital ng Makati KPI Dashboard  
**Department:** Quality Assurance Division / IT  
**Date Prepared:** [Insert Date]  

---

## 1. Objective
To develop a centralized, web-based dashboard for monitoring Key Performance Indicators (KPIs) across all hospital sections. This system replaces fragmented spreadsheet reporting with a unified interface for tracking performance trends, identifying non-conformances, and facilitating management review, complying with **ISO 9001:2015 Clause 9.1 (Monitoring, measurement, analysis and evaluation)**.

## 2. Development Stages

### Phase 1: Planning & Requirements Gathering
*   **Input:** Review of existing "Quality Objectives" and monthly reporting formats (QS-001 forms).
*   **Activity:** Consultation with QA Head to define standard KPIs (TAT, Patient Safety, Data Accuracy) and calculation formulas.
*   **Output:** Software Requirements Specification (SRS).

### Phase 2: Design & Prototyping
*   **Activity:** UI/UX design focusing on visual clarity (Gauges, Heatmaps).
*   **Activity:** Architecture design using ReactJS for the frontend and Google Sheets as a lightweight, accessible backend.
*   **Review:** Approval of the "Conformant/Non-Conformant" visual logic by QA Manager.

### Phase 3: Development / Coding
*   **Activity:** Frontend development using ReactJS, TailwindCSS (OsMak Green Branding).
*   **Activity:** Implementation of "Batch Data Entry" to mimic spreadsheet efficiency.
*   **Backend:** Integration with Google Apps Script to serve as the API layer.
*   **Optimization:** Implementation of client-side caching to ensure fast load times.

### Phase 4: Verification (Testing)
*   **Activity:** Developer performs unit testing on conformance logic (High vs Low targets).
*   **Activity:** Execution of Test Scripts (See `3_Verification_Tests.md`).

### Phase 5: Validation & Deployment
*   **Activity:** User Acceptance Testing (UAT) by QA Officers and selected Section Heads.
*   **Output:** UAT Sign-off and Go-Live.

## 3. Responsibilities and Authorities
*   **Project Lead / Developer:** Responsible for code architecture, API integration, and performance optimization.
*   **Process Owner (QA Manager):** Responsible for defining KPI targets, operational definitions, and acceptance of the visualization methods.
*   **End Users (Section Heads):** Responsible for accurate monthly data submission.

## 4. Resources
*   **Hardware:** Standard hospital workstations / Laptops.
*   **Software:** Visual Studio Code, ReactJS, Recharts, Google Sheets (Backend).
*   **Reference Standards:** ISO 9001:2015 Standard (Clause 9.1).

---
**Prepared By:** Max Angelo G. Terrenal (Developer)  
**Approved By:** _________________________ (QA Manager)