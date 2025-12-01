# OsMak KPI Dashboard - User Manual

## **1. System Overview**
The **OsMak KPI Dashboard** is a digital platform designed to visualize and track Key Performance Indicators across the hospital. It allows sections to input their monthly performance data and provides QA with automated tools for analysis and reporting.

### **Core Features**
*   **KPI Trend**: Visual charts showing performance over time vs. targets.
*   **Top Performers**: Leaderboard identifying high-performing and critical sections.
*   **Records Database**: Full history of submissions with edit/delete capabilities.
*   **Non-Submission**: Auto-tracking of late or missing reports.

---

## **2. Getting Started**

### **Access & Login**
*   **Viewer Mode**: Anyone can view the dashboard charts and tables without logging in.
*   **Admin/Editor Mode**: Required for adding or changing data.
    *   **Password**: `osmak123`

### **Navigation Bar**
*   **KPI Trend**: Main analytics view.
*   **Top Performers**: Categorized section performance.
*   **Records**: Data management table.
*   **Non-Submission**: Late report tracking.
*   **KPI**: Reference list of Definitions, Formulas, and Targets.

---

## **3. Using the Dashboard**

### **A. Analyzing Trends (KPI Trend)**
1.  Select a **Section** from the dropdown (e.g., "Emergency Room Complex").
2.  (Optional) Filter by **KPI** or **Department**.
3.  Adjust the **Date Range** to zoom in on a specific period.
4.  **Visuals**:
    *   **Bar Chart**: Shows your actual performance.
    *   **Dotted Line**: Shows the Target.
    *   **Gauge**: Shows overall Success Rate.
    *   **Tooltip**: Hover over bars to see the exact Variance (Pass/Fail).

### **B. Managing Data (Records)**

#### **Adding New Records (Batch Mode)**
1.  Go to the **Records** tab.
2.  Click **"+ Add Entry"**.
3.  Enter the Admin Password (`osmak123`) if prompted.
4.  The **Batch Data Entry** spreadsheet will open.
5.  **Select Section**: The KPI dropdown will auto-update.
6.  **Select KPI**: The Target and Unit will auto-fill.
7.  **Enter Data**: Input Month, Census, and Actual Performance.
8.  **Add Rows**: Click "Add Row" or "Duplicate" to enter multiple months at once.
9.  Click **"Save Records"**.

#### **Editing/Deleting**
*   Click the **Pencil Icon** on any row in the table to edit a single record.
*   Click the **Trash Icon** to delete a record (requires confirmation).

### **C. Top Performers & Heatmaps**
1.  Go to the **Top Performers** tab.
2.  Click on any **Section Card** (e.g., "Radiology").
3.  The view will drill down to show:
    *   **Best KPI**: The metric with the highest pass rate.
    *   **Worst KPI**: The metric struggling the most.
    *   **Heatmap**: A grid showing Green (Pass) or Red (Fail) for every month.

---

## **4. Troubleshooting**

| Issue | Solution |
| :--- | :--- |
| **"No Data" shown in charts** | Check your Date Range filters. Ensure data has been encoded for that period. |
| **New entry not showing up** | The system caches data for 5 minutes. Refresh the page or wait a few minutes. |
| **"Load Failed" error** | Check your internet connection. The app requires access to Google Sheets. |
| **Target value is wrong** | Check the **KPI** tab definitions. Contact QA to update the standard target. |

---
**Technical Support:** Information Technology Section / Quality Assurance Division