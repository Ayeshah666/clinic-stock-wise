# Clinic Stock Manager

Build a complete local clinic pharmacy inventory management system.

This is an internal pharmacy management system, NOT an online medicine-shopping/e-commerce platform. There must be no shopping cart, online ordering, customer checkout, payment gateway, delivery system, public marketplace, or customer-facing e-commerce functionality.

The system is intended for a pharmacy operating inside a clinic. Its primary purpose is to help pharmacy staff manage medicines, stock, suppliers, purchases, dispensing, expiry dates, low-stock alerts, and reports.

1. DESIGN DIRECTION

Create a clean, professional, modern healthcare/pharmacy dashboard.

Visual style

Use a blue-based healthcare color palette.

Prefer navy blue, royal blue, slate blue, sky blue, and very light blue/gray backgrounds.

White should be the primary surface/background color.

Use subtle blue accents for active states and important UI elements.

Use green for healthy/in-stock/success states.

Use amber/orange for warnings.

Use red only for critical states such as expired medicines or very low stock.

Use neutral gray for secondary text and borders.

IMPORTANT — DO NOT MAKE IT LOOK LIKE AI-GENERATED UI

Do NOT use:

Purple gradients

Blue-purple gradients

Giant gradient hero sections

Excessive glassmorphism

Neon colors

Excessive rounded cards

Huge decorative illustrations

Floating blobs

Excessive shadows

Generic "AI SaaS" dashboard styling

Unnecessary animations

The interface should look like a real professional pharmacy/clinic management application, similar to software actually used by healthcare staff.

Use:

Clean spacing

Clear typography

Subtle borders

Moderate border radius

Simple icons

Strong information hierarchy

Dense but readable data tables

Practical forms

Clear status badges

Consistent buttons

Responsive layouts

Use a persistent left sidebar navigation on desktop and a suitable mobile navigation pattern on smaller screens.

The dashboard should prioritize information rather than decoration.

2. USER ROLES

Implement basic role-based access control.

Admin

Can:

Manage users

Add/edit/deactivate medicines

Manage suppliers

View all inventory

Record purchases

Record dispensing

Perform stock adjustments

View reports

View audit logs

Pharmacist

Can:

View inventory

Search medicines

Record dispensing

Record received stock

Manage stock adjustments

View expiry and low-stock alerts

View reports

Pharmacy Assistant

Can:

Search medicines

View inventory

Record dispensing

Record received stock

View basic alerts

Sensitive actions such as major stock adjustments, deleting records, and user management should be restricted to authorized roles.

3. MAIN NAVIGATION

Create these main sections:

Dashboard

Medicines

Inventory

Purchases

Dispensing

Suppliers

Patients / Prescriptions

Alerts

Reports

Users

Audit Log

Settings

4. DASHBOARD

Create a practical pharmacy dashboard.

At the top, show summary cards:

Total Medicines

Total Items in Stock

Low Stock Medicines

Expiring Soon

Expired Medicines

Today's Dispensing

Today's Stock Received

Below the summary cards, show:

Low Stock

A table containing:

Medicine

Current Stock

Reorder Level

Status

Action

Expiring Soon

A table containing:

Medicine

Batch Number

Current Quantity

Expiry Date

Days Remaining

Status

Recent Stock Activity

Show recent:

Stock received

Medicines dispensed

Stock adjustments

Quick Actions

Provide clear buttons:

Add Medicine

Receive Stock

Dispense Medicine

Add Supplier

View Alerts

The dashboard should be useful immediately after login.

5. MEDICINE MANAGEMENT

Create a medicine management module.

Each medicine should contain:

Medicine ID

Medicine Name

Generic Name

Brand / Manufacturer

Category

Dosage Form

Strength

Unit

Reorder Level

Storage Location

Prescription Required

Active / Inactive Status

Created Date

Examples of dosage forms:

Tablet

Capsule

Syrup

Injection

Cream

Ointment

Drops

Inhaler

Suspension

Allow users to:

Add medicine

Edit medicine

View medicine details

Search medicine

Filter medicines

Deactivate medicine

View associated inventory

View stock history

Do not permanently delete medicines that have historical transactions. Use an active/inactive status instead.

6. INVENTORY MANAGEMENT

Inventory should track stock at the medicine batch level.

Each stock batch should contain:

Medicine

Batch Number

Quantity Received

Current Quantity

Manufacturing Date

Expiry Date

Purchase Price

Supplier

Date Received

Storage Location

IMPORTANT:

Do NOT create a separate "Batch ID" field.

The manufacturer/supplier Batch Number is sufficient for identifying a batch.

Do NOT include selling price or dispensing price.

The system should support multiple batches of the same medicine.

Example:

Paracetamol 500mg:

Batch P123:

Quantity: 100

Expiry: October 2026

Batch P456:

Quantity: 250

Expiry: March 2027

The system must keep these batches separate.

7. FEFO INVENTORY LOGIC

Implement FEFO — First Expire, First Out.

When dispensing a medicine, the system should recommend the valid batch with the earliest expiry date.

Example:

Paracetamol:

Batch A → expires September 2026
Batch B → expires February 2027
Batch C → expires August 2027

The system should recommend:

Batch A first.

Do not recommend expired batches.

If a batch is expired, prevent normal dispensing from that batch.

8. STOCK RECEIVING / PURCHASES

Create a stock receiving workflow.

A pharmacist/admin should be able to record medicines received from suppliers.

Purchase/receiving information:

Purchase ID

Supplier

Invoice Number

Purchase Date

Received By

Notes

Each purchase can contain multiple medicines.

Purchase item information:

Medicine

Batch Number

Quantity

Purchase Price

Manufacturing Date

Expiry Date

When a purchase is submitted:

Create the purchase record.

Create/update the relevant medicine batch.

Increase inventory.

Create a stock transaction.

Record the user who performed the operation.

9. DISPENSING

Create an internal medicine dispensing module.

This is NOT an online order system.

The pharmacist should be able to record medicines dispensed to patients from the clinic.

Dispensing information:

Dispensing ID

Patient

Prescription

Dispensing Date

Dispensed By

Notes

Dispensing items:

Medicine

Batch Number

Quantity Dispensed

When dispensing:

Select/search the medicine.

Show available stock.

Recommend the FEFO batch.

Prevent dispensing more than available quantity.

Prevent dispensing expired batches.

Reduce stock automatically.

Create a stock transaction.

Record who dispensed the medicine.

10. PATIENTS / PRESCRIPTIONS

Because this is a clinic pharmacy, include a lightweight patient/prescription module.

Patient information should be minimal:

Patient ID

Patient Name

Contact Number

Optional basic identifying information required by the clinic

Active/Inactive status

Do not build a complete hospital management system.

Prescription information:

Prescription ID

Patient

Prescribing Doctor

Prescription Date

Notes

Prescription Items

Prescription item:

Medicine

Prescribed Quantity

Dosage Instructions

Duration

A prescription can then be linked to a dispensing record.

The system should clearly distinguish:

Prescribed quantity vs actually dispensed quantity.

11. STOCK TRANSACTIONS

Create a complete stock movement history.

Every inventory change should create a transaction.

Transaction types:

Stock Received

Dispensed

Damaged

Expired

Returned

Manual Adjustment

Each transaction should record:

Transaction ID

Medicine

Batch Number

Transaction Type

Quantity Change

Previous Quantity

New Quantity

Reason

User

Date/Time

This creates a reliable inventory audit trail.

12. STOCK ADJUSTMENTS

Create a controlled stock adjustment feature.

Example:

Paracetamol 500mg
Batch: P123
Previous quantity: 100
Adjustment: -5
Reason: Damaged medicine
New quantity: 95

Require a reason for every manual adjustment.

Possible reasons:

Damaged

Expired

Lost

Physical count correction

Returned

Other

Show the adjustment in the audit history.

13. LOW-STOCK ALERTS

Each medicine should have a configurable reorder level.

Example:

Current stock: 15
Reorder level: 30

Show:

Low Stock

Create an Alerts page with:

Medicine

Current Quantity

Reorder Level

Severity

Date

Use clear status indicators.

Do not use excessive notification animations.

14. EXPIRY ALERTS

Automatically identify:

Expired

Expiry date has passed.

Expiring Soon

Medicine is within a configurable number of days from expiry.

Default:

90 days

Allow the admin to change this setting.

Show:

Medicine

Batch Number

Quantity

Expiry Date

Days Remaining

Status

Expired medicine should be clearly marked and excluded from normal dispensing.

15. SUPPLIER MANAGEMENT

Create a supplier module.

Supplier information:

Supplier ID

Supplier Name

Contact Person

Phone

Email

Address

Status

Notes

Allow users to:

Add supplier

Edit supplier

View supplier

Deactivate supplier

View purchase history

16. REPORTS

Create a Reports section.

Include:

Inventory Report

All medicines

Current stock

Reorder levels

Stock status

Expiry Report

Expired medicines

Expiring soon

Expiry dates

Quantities

Low Stock Report

Medicines below reorder level

Purchase Report

Purchases by date range

Supplier

Medicines received

Quantities

Dispensing Report

Medicines dispensed

Quantity

Patient

Date

Pharmacist

Stock Movement Report

All stock transactions

Transaction type

Quantity

User

Date/time

Allow filtering by:

Date range

Medicine

Supplier

Transaction type

User

Provide CSV/PDF export where practical.

17. AUDIT LOG

Create an audit log for important actions.

Record:

User

Action

Module

Record affected

Date/time

Description

Examples:

"Admin added new medicine"

"Pharmacist dispensed 10 tablets of Paracetamol 500mg"

"Admin adjusted stock by -5"

"Assistant received 100 capsules"

This should provide accountability for inventory changes.

18. SEARCH AND FILTERING

The system should have fast search functionality.

Allow searching by:

Medicine name

Generic name

Brand

Batch number

Inventory filters:

In stock

Low stock

Expiring soon

Expired

Out of stock

Active/inactive

Tables should support sorting and pagination where necessary.

19. MEDICINE DETAILS PAGE

Clicking a medicine should open a detailed view.

Show:

Medicine Information

Name, generic name, brand, strength, dosage form, etc.

Current Inventory

All active batches and quantities.

Expiry Status

Stock History

A chronological list of received, dispensed, and adjusted quantities.

Supplier History

Recent Dispensing

The medicine detail page should give the pharmacist a complete picture without requiring them to open many separate pages.

20. SETTINGS

Include basic system settings:

Pharmacy/clinic name

Expiry warning period

Default reorder level settings

User preferences

Notification preferences

Do not add unnecessary enterprise features.

21. RESPONSIVE DESIGN

The application must work well on:

Desktop

Laptop

Tablet

Mobile

Desktop should use a sidebar.

On mobile:

Collapse the sidebar into a menu

Make tables horizontally scrollable where necessary

Keep forms usable

Make important actions easy to access

22. DATA VALIDATION

Implement proper validation.

Examples:

Medicine name cannot be empty.

Quantity cannot be negative.

Expiry date cannot be before manufacturing date.

Dispensed quantity cannot exceed available stock.

Expired batches cannot be dispensed.

Batch number should be required when receiving stock.

Supplier should be selected for purchased stock.

Stock adjustment requires a reason.

Required fields should have clear validation messages.

Use confirmation dialogs before destructive/sensitive actions.

23. EMPTY STATES AND ERROR STATES

Do not leave blank screens.

Create useful empty states such as:

"No medicines have been added yet."

"No low-stock medicines."

"No medicines are expiring soon."

"No dispensing records found."

"No purchases found."

Also create clear error and success messages.

24. SAMPLE DATA

Populate the application with realistic demo data so the UI is immediately testable.

Include example medicines such as:

Paracetamol 500mg

Amoxicillin 500mg

Cetirizine 10mg

Omeprazole 20mg

Ibuprofen 400mg

Azithromycin 500mg

ORS

Cefixime 200mg

Include multiple suppliers, batches, purchases, patients, prescriptions, dispensing records, low-stock medicines, and medicines approaching expiry.

Make sure the dashboard reflects the demo data.

25. DATABASE / DATA MODEL

Use a relational database structure.

Recommended entities:

Users

Roles

Medicines

Medicine Categories

Medicine Batches

Suppliers

Purchases

Purchase Items

Patients

Prescriptions

Prescription Items

Dispensing

Dispensing Items

Stock Transactions

Notifications/Alerts

Audit Logs

Settings

Relationships must preserve historical inventory records.

Do not permanently delete medicines, suppliers, or users if they are referenced by historical records. Prefer an active/inactive status.

26. IMPORTANT SCOPE RESTRICTIONS

This is a LOCAL CLINIC PHARMACY INVENTORY SYSTEM.

Do NOT build:

Online medicine store

Shopping cart

Online checkout

Payment gateway

Home delivery

Customer marketplace

Public medicine catalog

Product reviews

Wishlist

E-commerce order tracking

Online customer registration

The system is for authorized clinic/pharmacy staff.

27. UI QUALITY REQUIREMENTS

The final application should look like a polished real-world healthcare management product.

Use a visual hierarchy similar to:

Sidebar
→ Dashboard
→ Medicines
→ Inventory
→ Purchases
→ Dispensing
→ Patients/Prescriptions
→ Suppliers
→ Alerts
→ Reports
→ Users
→ Audit Log
→ Settings

Use consistent:

Typography

Button styles

Table styles

Form controls

Status badges

Icons

Spacing

Blue color palette

Use subtle borders and shadows rather than heavy visual effects.

Prioritize usability, readability, and information density over decorative design.

The final result should feel like a professional clinic pharmacy management system, not an AI-generated SaaS landing page.

Build the MVP fully functional with working CRUD operations, database relationships, authentication/authorization, inventory calculations, FEFO logic, low-stock detection, expiry detection, stock transactions, dispensing, purchase receiving, reports, and audit logging.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7fde4b49-e9ac-45d0-aafd-5e5c29fcf8d9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
