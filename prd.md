# BiteFlow — Product Requirements Document (PRD)

Version: 1.0
Status: Greenfield rebuild / MVP
Product: BiteFlow — Multi-Tenant Restaurant SaaS

## 1. Product Vision

BiteFlow is a multi-tenant SaaS platform for restaurants, cafes, food courts, cloud kitchens, and similar food businesses.

It combines:
- Restaurant website/menu
- QR table ordering
- Order management
- Kitchen Display System (KDS)
- Table management
- Reservations
- Staff management
- Inventory
- Customer management
- Loyalty
- Analytics
- Subscription billing
- Restaurant branding/white-label capabilities

The product must be designed from the ground up as a production-oriented SaaS, not as a single restaurant application.

## 2. Product Goals

1. Let a restaurant create and launch its digital ordering system quickly.
2. Give each restaurant an isolated tenant/workspace.
3. Allow each tenant to customize its customer-facing brand.
4. Enable customers to scan a table QR and order without friction.
5. Give kitchen and staff real-time operational workflows.
6. Monetize through subscription plans and feature/usage limits.
7. Provide a polished responsive SaaS dashboard.
8. Build the foundation for future AI integrations without making AI a dependency of MVP.

## 3. Target Users

### Platform Super Admin
Manages the BiteFlow SaaS:
- Tenants
- Subscription plans
- Platform metrics
- Billing/subscription status
- Support/admin operations
- Audit logs

### Restaurant Owner
Owns a restaurant tenant:
- Onboards restaurant
- Selects plan
- Customizes brand
- Manages menu/tables/QR
- Monitors orders
- Manages staff
- Reviews analytics
- Manages subscription

### Restaurant Manager
Runs day-to-day operations:
- Orders
- Tables
- Reservations
- Inventory
- Employees
- Analytics

### Chef / Kitchen Staff
- View incoming orders
- Accept/start orders
- Update preparation status
- Mark orders ready

### Waiter
- Monitor assigned tables
- Handle service requests
- Assist with order/table workflow

### Cashier
- Manage bills
- Confirm payments
- Complete checkout

### Customer
- Browse restaurant
- Customize items
- Add to cart
- Order
- Track order
- Request assistance
- View/pay bill
- Earn loyalty points

## 4. Core SaaS Workflow

The complete platform workflow must be:

Landing Page
→ Sign Up
→ Create Restaurant
→ Select Subscription
→ Restaurant Setup
→ Branding
→ Menu Setup
→ Table Setup
→ QR Generation
→ Invite Staff
→ Launch Restaurant
→ Customer Scans QR
→ Browse Menu
→ Add Items
→ Place Order
→ Kitchen Receives Order
→ Kitchen Prepares
→ Order Ready
→ Staff Serves
→ Bill
→ Payment
→ Customer Receipt
→ Restaurant Analytics

## 5. SaaS Information Architecture

### Public
- `/`
- `/features`
- `/pricing`
- `/demo`
- `/about`
- `/contact`
- `/login`
- `/signup`

### Authenticated Restaurant Application
- `/app`
- `/app/dashboard`
- `/app/orders`
- `/app/kitchen`
- `/app/tables`
- `/app/menu`
- `/app/reservations`
- `/app/inventory`
- `/app/employees`
- `/app/customers`
- `/app/analytics`
- `/app/billing`
- `/app/branding`
- `/app/settings`

### Customer
- `/r/:restaurantSlug`
- `/r/:restaurantSlug/table/:tableNumber`
- `/r/:restaurantSlug/menu/:itemId`
- `/r/:restaurantSlug/cart`
- `/r/:restaurantSlug/order/:orderId`
- `/r/:restaurantSlug/bill`

### Platform Admin
- `/admin`
- `/admin/tenants`
- `/admin/plans`
- `/admin/subscriptions`
- `/admin/analytics`
- `/admin/audit`

## 6. Tenant Model

Every restaurant is an independent tenant.

Core tenant object:
- id
- name
- slug
- logo
- businessType
- GST number
- timezone
- currency
- language
- branding configuration
- subscription plan
- subscription status
- subscription expiry

Every tenant-owned record must reference `organizationId`.

Tenant isolation must be enforced server-side and at database level. Client-provided organization IDs must never be the sole authorization mechanism.

## 7. Subscription System

Suggested plans:

### Starter
For small cafes and single-location businesses.
- Digital menu
- QR ordering
- Basic table management
- Basic analytics
- Limited tables/menu items/staff

### Growth
For growing restaurants.
- Everything in Starter
- KDS
- Staff management
- Reservations
- Inventory
- Advanced analytics
- Custom branding

### Pro
For larger restaurants and multi-location businesses.
- Everything in Growth
- Multiple branches
- Advanced analytics
- Advanced inventory
- Loyalty
- API access
- Higher limits

### Enterprise
- Custom limits
- Multi-branch
- Custom integrations
- Advanced RBAC
- API
- Dedicated support
- White-label options

Subscription limits should support:
- maxBranches
- maxEmployees
- maxTables
- maxMenuItems
- maxOrdersPerMonth
- maxCustomers
- maxStorage

## 8. Restaurant Onboarding

Create a guided setup wizard:

1. Account
2. Restaurant details
3. Subscription
4. Branding
5. Menu
6. Tables
7. Staff
8. Launch

Each step must have:
- Progress indicator
- Validation
- Save/continue
- Back
- Skip where appropriate
- Completion state

A restaurant should be able to reach a usable demo/launch state without database/admin intervention.

## 9. Branding / White Label

Tenant branding:
- Logo
- Primary color
- Secondary color
- Accent color
- Font family
- Border radius
- Button style
- Card style
- Menu layout
- Hero/banner content

The customer-facing restaurant experience must dynamically use tenant branding.

Provide a live preview while editing branding.

## 10. Menu Management

Restaurant staff can:
- Create categories
- Create menu items
- Edit items
- Delete/archive items
- Set prices
- Add descriptions
- Upload images
- Set calories
- Set preparation time
- Toggle availability
- Mark Chef Pick
- Mark Trending
- Add customization/options

Menu item:
- id
- organizationId
- categoryId
- name
- description
- price
- image
- preparationTime
- calories
- available
- featured flags
- customization data

## 11. QR Ordering

Each table receives a unique QR.

Recommended customer URL:
`/r/{restaurantSlug}/table/{tableNumber}`

QR must identify:
- Restaurant
- Branch where applicable
- Table

Features:
- Generate individual QR
- Bulk generate
- Download
- Print
- Copy URL
- Regenerate
- Preview

Customers should be able to browse the menu without signing in.

## 12. Customer Ordering

Customer flow:
1. Scan QR
2. Restaurant page
3. Browse categories
4. Search/filter
5. Open item
6. Customize
7. Add to cart
8. Review cart
9. Add notes/allergy information
10. Place order
11. Track status
12. View bill
13. Pay
14. Receipt

Customer UI must be mobile-first.

## 13. Order Lifecycle

Default status:

Pending
→ Accepted
→ Preparing
→ Ready
→ Served
→ Completed

Cancellation:
- Pending → Cancelled
- Other transitions depend on restaurant permissions.

Order fields:
- id
- organizationId
- orderNumber
- tableNumber
- user/customer reference
- status
- items
- notes
- allergyNote
- kitchenNote
- timestamps
- payment state

## 14. Kitchen Display System

KDS should show:
- New orders
- Preparing orders
- Ready orders
- Completed orders
- Table number
- Order number
- Items
- Quantity
- Customizations
- Allergy warnings
- Kitchen notes
- Preparation timer

Primary actions:
- Accept
- Start Preparing
- Mark Ready
- Complete

KDS should be optimized for large desktop/tablet displays and rapid operation.

## 15. Table Management

Table fields:
- id
- organizationId
- tableNumber
- capacity
- status
- assignedWaiter
- currentBill
- occupiedTime
- QR URL

Statuses:
- Available
- Occupied
- Reserved
- Waiting
- Cleaning

Views:
- Grid
- Floor layout
- List

Actions:
- Add table
- Edit
- Assign waiter
- View order
- View bill
- Generate QR
- Change status

## 16. Service Requests

Customer requests:
- Call waiter
- Water
- Bill
- Assistance
- Cleaning
- Other

Staff can:
- Accept
- In progress
- Complete
- Cancel

Requests should appear as realtime notifications.

## 17. Reservations

Reservation fields:
- customer name
- email/phone where appropriate
- date
- time
- guests
- special requests
- table
- status

Statuses:
- Pending
- Confirmed
- Completed
- Cancelled
- No Show

Provide:
- Calendar
- Day list
- Reservation details
- Confirm/cancel actions

## 18. Inventory

Inventory:
- Ingredient
- Current stock
- Low-stock threshold
- Unit
- Expiry date
- Supplier

Statuses:
- Healthy
- Low Stock
- Critical
- Expired

Future:
- Automatic stock deduction
- Purchase orders
- Waste tracking
- Forecasting
- Supplier management

## 19. Employees and RBAC

Roles:
- Super Admin
- Organization Owner
- Manager
- Cashier
- Chef
- Kitchen Staff
- Waiter
- Customer

Permissions must be granular and server-enforced.

Example:
- Owner: full tenant management
- Manager: operational management
- Chef: kitchen
- Waiter: tables/service
- Cashier: billing
- Customer: own customer actions

## 20. Customer Management

Store appropriate customer profile information:
- Customer ID
- Name
- Contact details where consented/needed
- Order history
- Loyalty balance
- Visit count
- Last visit
- Preferences where explicitly collected

Provide:
- Search
- Customer details
- Order history
- Loyalty
- Segments

## 21. Loyalty

MVP:
- Earn points based on configurable rules
- View balance
- Redeem rewards
- Customer history

Example:
- ₹100 spent = 10 points

Do not make loyalty dependent on blockchain or external wallet systems.

## 22. Analytics

Restaurant dashboard:
- Revenue
- Orders
- Average order value
- Table utilization
- Top items
- Low-performing items
- New vs returning customers
- Peak ordering hours
- Average preparation time
- Cancellation rate
- Staff performance

Time filters:
- Today
- 7 days
- 30 days
- 90 days
- Custom

## 23. Billing and Payments

Restaurant SaaS billing:
- Current plan
- Price
- Renewal date
- Upgrade
- Downgrade
- Cancel
- Invoice history
- Payment method

Customer restaurant checkout should support a payment-provider abstraction so providers can be integrated without coupling the order domain to a single vendor.

For India, the prototype may use Razorpay. Stripe can be added for international use cases.

## 24. Notifications

Support:
- In-app notifications
- Order status notifications
- Service requests
- Reservation updates
- Low inventory
- Subscription warnings

Future:
- Email
- SMS
- WhatsApp
- Push notifications

## 25. Realtime Requirements

Realtime updates are important for:
- KDS
- Order status
- Table status
- Service requests
- Staff notifications

Use a realtime layer such as Supabase Realtime or WebSockets.

## 26. Security Requirements

Mandatory:
- Secure authentication
- Server-side authorization
- Tenant isolation
- RBAC
- Database RLS
- Input validation
- Rate limiting
- Secure secrets
- Secure payment webhooks
- Audit logging
- HTTPS
- Protection against IDOR
- Protection against cross-tenant access

Never trust frontend-only role checks or organization IDs.

## 27. Audit Logs

Log important actions:
- Login/logout
- Tenant creation
- Plan changes
- Menu changes
- Order changes
- Employee role changes
- Refunds
- Subscription changes
- Admin impersonation
- Security-sensitive configuration changes

## 28. Non-Functional Requirements

Performance:
- Fast initial load
- Common API operations target <500ms under normal prototype conditions
- Avoid unnecessary network requests

Responsive:
- Customer: mobile-first
- Dashboard: desktop/tablet
- KDS: large screen optimized

Accessibility:
- WCAG-oriented implementation
- Keyboard support
- Focus states
- Semantic HTML
- Accessible forms
- Sufficient contrast
- Do not rely on color alone

## 29. MVP Scope

Must have:
- Marketing site
- Authentication
- Restaurant onboarding
- Subscription plans
- Tenant management
- Branding
- Menu
- Tables
- QR
- Customer ordering
- Orders
- KDS
- Staff roles
- Dashboard
- Billing UI
- Analytics

Should have:
- Reservations
- Inventory
- Customer management
- Loyalty
- Service requests

Can follow after MVP:
- AI assistant
- Advanced forecasting
- Advanced automation
- Multi-branch enterprise controls
- White-label reseller system

## 30. Demo Golden Path

For a 3–5 minute product demo:

1. Open BiteFlow landing page.
2. Click Start Free.
3. Create restaurant.
4. Select Growth plan.
5. Customize logo/colors.
6. Add a few menu items.
7. Create tables.
8. Generate QR.
9. Open customer QR experience.
10. Add food to cart.
11. Place order.
12. Switch to KDS.
13. Accept and prepare order.
14. Mark Ready.
15. Open table/order view.
16. Complete bill/payment simulation.
17. Show analytics.
18. Show subscription/billing.
19. Switch tenant and demonstrate different branding.

## 31. Prototype Tenants

Seed:
- Urban Bean Cafe
- Spice Route Restaurant
- The Green Bowl

Each must have different:
- Brand
- Menu
- Tables
- Demo data

## 32. Definition of Done

The greenfield rebuild is ready for prototype demonstration when:
- A new tenant can be created from UI.
- A subscription can be selected.
- Branding can be configured.
- Menu can be created.
- Tables can be created.
- QR codes can be generated.
- Customer can order from QR.
- Order reaches KDS.
- KDS can update order.
- Table/bill state updates.
- Dashboard displays tenant-specific metrics.
- Roles are enforced.
- Tenant data is isolated.
- Billing screens work.
- Demo can run without manual DB edits.
