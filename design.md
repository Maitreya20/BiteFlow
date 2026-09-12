# BiteFlow — End-to-End UI/UX Design Specification for Google Stitch

Version: 1.0
Purpose: Use this document as the master UI/UX specification for generating the entire BiteFlow website and SaaS application from scratch.

## 1. Design Direction

BiteFlow should look like a premium modern SaaS product combined with a polished restaurant digital experience.

Design characteristics:
- Premium
- Clean
- Minimal
- Fast
- Professional
- Highly visual
- Mobile-first customer experience
- Desktop-first restaurant dashboard
- Clear information hierarchy
- Strong but restrained use of tenant branding

Avoid:
- Generic admin-template appearance
- Excessive gradients
- Excessive glassmorphism
- Crypto/Web3 styling
- Cluttered dashboards
- Tiny text
- Too many charts
- Heavy animations

## 2. Design System Foundation

### Typography
Primary:
- Inter or Manrope

Hierarchy:
- Display: 48–64px desktop
- H1: 36–44px
- H2: 28–32px
- H3: 20–24px
- Body: 14–16px
- Caption: 12–13px

Use responsive type scaling.

### Base Colors
Platform:
- Background: near-white/slate
- Surface: white
- Primary text: dark slate
- Secondary text: muted slate
- Border: light slate
- Destructive: red
- Warning: amber
- Success: green
- Info: blue

Tenant colors are configurable and should primarily affect the customer-facing restaurant UI.

### Radius
Default:
- Cards: 12–16px
- Inputs: 10–12px
- Buttons: 10–12px
- Large surfaces: 20–24px

Allow tenant customization for restaurant UI.

### Shadows
Use subtle elevation:
- Card
- Dropdown
- Modal
- Floating cart

Avoid heavy shadows.

## 3. Global Navigation

Marketing navigation:
- Logo
- Product
- Features
- Pricing
- Demo
- Login
- Start Free

Authenticated dashboard:
- Tenant switcher
- Search
- Notifications
- Help
- Profile

## 4. Marketing Website — Complete Page Structure

### Page 1: Landing Page

Sections:
1. Navbar
2. Hero
3. Product preview
4. Benefits
5. Feature grid
6. How it works
7. QR ordering visual
8. Kitchen visual
9. Analytics visual
10. Testimonials
11. Pricing preview
12. FAQ
13. CTA
14. Footer

Hero:
Headline:
"Turn Every Table Into a Digital Ordering Experience."

Subheadline:
"QR ordering, kitchen management, payments, analytics and restaurant automation — all in one platform."

CTA:
- Start Free
- View Demo

Hero visual:
- Large dashboard preview
- Small floating order/KDS cards

### Page 2: Features
Feature groups:
- QR Ordering
- Digital Menu
- Kitchen Display
- Tables
- Reservations
- Inventory
- Staff
- Analytics
- Loyalty
- Branding

### Page 3: Pricing
Four pricing cards:
- Starter
- Growth
- Pro
- Enterprise

Growth should be visually emphasized as recommended.

### Page 4: Demo
Interactive guided demo:
- Restaurant dashboard
- Customer menu
- KDS
- Analytics

### Page 5: Login
Minimal centered authentication card.

### Page 6: Signup
Two-column desktop:
- Form
- Product value/preview

## 5. Onboarding UI

Use a full-screen application shell.

Top:
BiteFlow logo
"Setup your restaurant"

Progress:
1 Account
2 Restaurant
3 Plan
4 Branding
5 Menu
6 Tables
7 Staff
8 Launch

### Step 1 — Account
Fields:
- Name
- Email
- Password

### Step 2 — Restaurant
Fields:
- Restaurant name
- Business type
- GST
- Currency
- Language
- Timezone

Right side:
Live restaurant preview.

### Step 3 — Subscription
Pricing cards.
Each card:
- Name
- Price
- Best for
- Features
- Limits
- CTA

### Step 4 — Branding
Two-column:
Left:
- Logo upload
- Color selectors
- Font
- Radius
- Button style
- Card style

Right:
Live customer menu preview.

### Step 5 — Menu
Options:
- Add manually
- Import menu

Show category and item creation.

### Step 6 — Tables
Show visual table grid.
Actions:
- Add table
- Set capacity
- Generate QR

### Step 7 — Staff
Invite:
- Manager
- Chef
- Waiter
- Cashier

### Step 8 — Launch
Checklist:
- Restaurant profile ✓
- Branding ✓
- Menu ✓
- Tables ✓
- QR ✓
- Staff ✓

CTA:
"Launch Restaurant"

## 6. Restaurant Dashboard Shell

Desktop layout:
- Fixed left sidebar
- Top bar
- Main content
- Optional right contextual panel

Sidebar:
OVERVIEW
- Dashboard

OPERATIONS
- Orders
- Kitchen
- Tables
- Reservations

CATALOG
- Menu
- Inventory

PEOPLE
- Customers
- Employees

INSIGHTS
- Analytics

BUSINESS
- Billing
- Branding
- Settings

Sidebar bottom:
- Help
- Tenant switcher
- User profile

## 7. Dashboard Page

Header:
"Good morning, Urban Bean Cafe 👋"

Date selector.

Metric cards:
- Today's Sales
- Orders
- Average Order Value
- Tables Occupied

Main area:
- Revenue chart
- Orders by hour
- Top menu items

Secondary:
- Recent orders
- Service requests
- Low stock
- Upcoming reservations

Quick actions:
- Add Menu Item
- Add Table
- Generate QR
- Invite Employee

## 8. Orders Page

Header:
Orders
Filter:
- All
- Pending
- Preparing
- Ready
- Completed
- Cancelled

Search.

Order table:
- Order
- Table
- Customer
- Items
- Amount
- Status
- Time
- Actions

Click opens order drawer.

Drawer:
- Order summary
- Items
- Notes
- Status timeline
- Customer
- Payment
- Actions

## 9. Kitchen Page

Full-width KDS.

Columns:
NEW
PREPARING
READY
COMPLETED

Order cards:
- Order number
- Table
- Time
- Items
- Quantity
- Customizations
- Allergy warning
- Kitchen note
- Action

Cards should be large and readable.

## 10. Tables Page

Top metrics:
- Total tables
- Available
- Occupied
- Reserved

Views:
- Grid
- Floor layout
- List

Table card:
Table number
Capacity
Status
Current bill
Waiter
Time occupied

Actions:
- Open
- Assign waiter
- QR
- Bill

## 11. QR Generator

Page:
"Table QR Codes"

Controls:
- Select table
- Generate
- Preview
- Download
- Print
- Copy link

Bulk mode:
- Select tables
- Download ZIP/PDF-style printable sheet

Preview:
Restaurant logo
Table number
QR
"Scan to Order"

## 12. Menu Page

Header:
Menu
Actions:
- Add Item
- Add Category
- Import

Category sidebar/list.

Item grid/list:
Image
Name
Description
Price
Availability
Badges
Actions

Item editor drawer:
- Image
- Name
- Category
- Description
- Price
- Calories
- Prep time
- Availability
- Chef Pick
- Trending
- Customizations

## 13. Reservations Page

Header:
Reservations

Controls:
- Calendar
- Day
- Week
- List

Reservation card:
- Time
- Customer
- Guests
- Table
- Status
- Special request

Actions:
- Confirm
- Edit
- Cancel
- Mark completed
- No show

## 14. Inventory Page

Top cards:
- Total items
- Low stock
- Critical
- Expiring

Inventory table:
Ingredient
Stock
Unit
Threshold
Supplier
Expiry
Status

Actions:
- Add ingredient
- Adjust stock
- Add supplier

## 15. Employees Page

Header:
Employees
CTA:
Invite Employee

Cards/table:
- Avatar
- Name
- Role
- Shift
- Status
- Performance

Employee drawer:
- Profile
- Role
- Permissions
- Schedule
- Activity

## 16. Customers Page

Top metrics:
- Total customers
- New customers
- Returning
- Loyalty points issued

Customer table:
- Customer
- Orders
- Total spend
- Last visit
- Loyalty
- Status

Customer drawer:
- Profile
- Order history
- Visit history
- Loyalty
- Preferences

## 17. Analytics Page

Header:
Analytics

Time filter:
Today / 7D / 30D / 90D / Custom

Sections:
Revenue
Orders
Customers
Tables
Menu
Kitchen

Charts:
- Revenue trend
- Orders trend
- Average order value
- Top menu items
- Category performance
- Peak hours
- Table utilization
- Kitchen preparation time

Keep charts simple and readable.

## 18. Billing Page

Top:
Current plan card.

Show:
- Plan
- Price
- Renewal
- Usage
- Limits

Usage meters:
Tables
Employees
Menu items
Orders

Actions:
- Upgrade
- Change plan
- Cancel
- Manage payment

Invoice table:
- Invoice
- Date
- Amount
- Status
- Download

## 19. Branding Page

Sections:
- Logo
- Colors
- Typography
- Buttons
- Cards
- Radius
- Customer menu layout

Two-column:
Editor + live preview.

Preview should resemble actual mobile restaurant menu.

## 20. Settings

Sections:
- Restaurant profile
- Business
- Tax
- Currency
- Notifications
- Roles & permissions
- Integrations
- Security
- Danger zone

## 21. Super Admin

Admin shell with:
- Overview
- Tenants
- Plans
- Subscriptions
- Analytics
- Audit

Admin dashboard metrics:
- Total restaurants
- Active subscriptions
- MRR
- Orders
- Churn
- New tenants

Tenant table:
- Restaurant
- Owner
- Plan
- Status
- Created
- Revenue
- Actions

## 22. Customer Restaurant Website

This is a separate experience from the SaaS dashboard.

Mobile-first.

Header:
- Restaurant logo
- Restaurant name
- Rating
- Open/closed
- Table identifier

Then:
- Search
- Category chips
- Featured section
- Menu sections

Floating cart:
"3 items · ₹679"

## 23. Customer Menu Item

Large image.
Name.
Description.
Price.

Options:
- Size
- Add-ons
- Customizations
- Quantity
- Special instruction

CTA:
"Add to Cart"

## 24. Customer Cart

Show:
- Items
- Quantity controls
- Customization
- Notes
- Subtotal
- Tax
- Total

CTA:
"Place Order"

## 25. Order Tracking

Large order number.

Timeline:
Received
Accepted
Preparing
Ready
Served

Show:
- Table
- Items
- Estimated time
- Restaurant contact/request waiter

## 26. Service Request UI

Floating action:
"Need help?"

Options:
- Call Waiter
- Water
- Bill
- Assistance

Show confirmation toast after request.

## 27. Bill Page

Show:
- Restaurant
- Table
- Items
- Subtotal
- Tax
- Discount
- Total

CTA:
"Pay Bill"

## 28. Payment UI

Keep provider-agnostic.

Show:
- Amount
- Payment method
- Processing
- Success
- Failure

Success:
"Payment successful"
Show receipt/order reference.

## 29. Mobile Navigation

Customer:
- Home
- Menu
- Orders
- Bill
- Profile

Restaurant app on mobile:
- Bottom nav for the most important operational sections
- Sidebar/drawer for secondary sections

## 30. Responsive Breakpoints

Mobile:
<768px

Tablet:
768–1023px

Desktop:
1024–1439px

Large desktop:
1440px+

KDS:
Optimize primarily for 1366px+.

## 31. Component Library

Create reusable:
- Button
- Input
- Select
- Checkbox
- Radio
- Switch
- Badge
- Avatar
- Card
- Modal
- Drawer
- Dropdown
- Tooltip
- Tabs
- Table
- Pagination
- Toast
- Alert
- Skeleton
- Empty state
- Confirmation dialog
- Date picker
- Search
- Filter bar
- Chart card
- Metric card
- Order card
- Table card
- Menu card
- Reservation card

## 32. States

Every important component needs:
- Default
- Hover
- Focus
- Active
- Disabled
- Loading
- Error
- Empty

## 33. Empty States

Examples:
"No menu items yet."
"Add your first menu item to start accepting orders."

Always include a relevant CTA.

## 34. Error States

Example:
"Something went wrong."
"Couldn't load your orders."
CTA:
"Try Again"

## 35. Subscription Limit States

When a plan limit is reached:
"You've reached your table limit."
"Upgrade your plan to add more tables."

CTA:
"View Upgrade Options"

Do not silently disable actions.

## 36. Expired Subscription

Show:
"Your subscription has expired."

Actions:
- Renew
- View plans

Keep essential account information visible where appropriate.

## 37. Accessibility

Design for:
- Keyboard navigation
- Visible focus
- Semantic labels
- Accessible dialogs
- Screen readers
- Contrast
- Large touch targets
- Non-color-only status communication

## 38. Animation

Use subtle transitions:
- Page transitions
- Drawer opening
- Toasts
- Cart changes
- Status updates
- Hover states

Avoid:
- Long animations
- Excessive parallax
- Distracting motion

## 39. Google Stitch Generation Guidance

Generate the product as a coherent design system, not isolated screens.

Required design order:

1. Global design system
2. Marketing site
3. Signup/login
4. Onboarding
5. Restaurant dashboard shell
6. Dashboard
7. Orders
8. Kitchen
9. Tables
10. QR
11. Menu
12. Reservations
13. Inventory
14. Employees
15. Customers
16. Analytics
17. Billing
18. Branding
19. Settings
20. Super Admin
21. Customer restaurant
22. Menu item
23. Cart
24. Order tracking
25. Bill/payment
26. Responsive variants
27. Empty/error/loading states

All screens must share:
- Same typography
- Same spacing system
- Same components
- Same icon style
- Same radius
- Same visual language

## 40. Primary UX Story

The final design must make this journey visually obvious:

Landing
→ Signup
→ Create Restaurant
→ Choose Plan
→ Brand Restaurant
→ Add Menu
→ Add Tables
→ Generate QR
→ Launch
→ Customer Scans
→ Customer Orders
→ Kitchen Receives
→ Kitchen Prepares
→ Order Ready
→ Bill
→ Payment
→ Analytics

This is the core product story and should be visually polished above all secondary features.
