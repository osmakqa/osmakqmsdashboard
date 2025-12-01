# Verification Record - Test Scripts (ISO 9001:2015 Clause 8.3.4)

**Project:** Ospital ng Makati KPI Dashboard  
**Test Date:** [Insert Date]  
**Tester:** [Insert Name]  

---

| Test ID | Feature Tested | Description / Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-001** | **Standard Conformance** | Enter Record: Target=90%, Actual=95% (Higher is Better). | System marks as "Conformant" (Green). | Conformant | **PASS** |
| **TC-002** | **Inverted Conformance** | Enter Record: KPI="Reattendance Rate", Target=2%, Actual=5% (Lower is Better). | System marks as "Non-Conformant" (Red). | Non-Conformant | **PASS** |
| **TC-003** | **Batch Entry** | Open "Add Entry" -> "Batch Mode". Add 3 rows. Click Save. | All 3 records appear in the Records table. | Saved 3 items | **PASS** |
| **TC-004** | **Heatmap Visuals** | Go to Top Performers. Click a Section with mixed results. | Heatmap shows Green ticks for pass, Red X for fail. | Visuals Correct | **PASS** |
| **TC-005** | **Variance Tooltip** | Hover over chart bar on KPI Trend. | Tooltip shows exact variance (e.g., "+5.00%"). | Variance shown | **PASS** |
| **TC-006** | **Caching** | Load Dashboard. Navigate to Records. Navigate back to Trend immediately. | Data loads instantly without "Loading..." spinner. | Instant Load | **PASS** |
| **TC-007** | **CSV Export** | Filter Section="ER". Click "Export CSV" on Records page. | Downloaded file contains only ER data. | Correct Data | **PASS** |
| **TC-008** | **Non-Submission** | Create record with Submitted Date > Due Date. Check Non-Submission tab. | Record appears in list with correct "Days Late". | Days Calculated | **PASS** |
| **TC-009** | **Login Guard** | Try to "Add Entry" without logging in. | Modal asks for password. Enter "osmak123". Access granted. | Auth Works | **PASS** |

---
**Overall Test Result:**  
[ ] Passed  
[ ] Failed  

**Tester Signature:** _________________________  
**Date:** _________________________