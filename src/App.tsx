import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppStoreProvider, useAppStore } from '@/store/AppStore'
import { CartProvider } from '@/store/CartStore'
import { ToastProvider } from '@/components/ui'
import { MarketingLayout } from '@/components/layout/MarketingLayout'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { CustomerShell } from '@/components/layout/CustomerShell'

/* Marketing */
import { LandingPage } from '@/pages/marketing/LandingPage'
import { FeaturesPage } from '@/pages/marketing/FeaturesPage'
import { PricingPage } from '@/pages/marketing/PricingPage'
import { DemoPage } from '@/pages/marketing/DemoPage'
import { AboutPage } from '@/pages/marketing/AboutPage'
import { ContactPage } from '@/pages/marketing/ContactPage'

/* Auth */
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignupPage } from '@/pages/auth/SignupPage'

/* Onboarding */
import { OnboardingFlow } from '@/pages/onboarding/OnboardingFlow'

/* Restaurant app */
import { DashboardPage } from '@/pages/app/DashboardPage'
import { OrdersPage } from '@/pages/app/OrdersPage'
import { KitchenPage } from '@/pages/app/KitchenPage'
import { TablesPage } from '@/pages/app/TablesPage'
import { QrGeneratorPage } from '@/pages/app/QrGeneratorPage'
import { ReservationsPage } from '@/pages/app/ReservationsPage'
import { MenuPage } from '@/pages/app/MenuPage'
import { InventoryPage } from '@/pages/app/InventoryPage'
import { EmployeesPage } from '@/pages/app/EmployeesPage'
import { CustomersPage } from '@/pages/app/CustomersPage'
import { AnalyticsPage } from '@/pages/app/AnalyticsPage'
import { BillingPage } from '@/pages/app/BillingPage'
import { BrandingPage } from '@/pages/app/BrandingPage'
import { SettingsPage } from '@/pages/app/SettingsPage'

/* Customer */
import { CustomerHome } from '@/pages/customer/CustomerHome'
import { CustomerMenu } from '@/pages/customer/CustomerMenu'
import { DishDetail } from '@/pages/customer/DishDetail'
import { CartPage } from '@/pages/customer/CartPage'
import { CustomerOrders } from '@/pages/customer/CustomerOrders'
import { OrderTracking } from '@/pages/customer/OrderTracking'
import { BillPage } from '@/pages/customer/BillPage'
import { CustomerProfile } from '@/pages/customer/CustomerProfile'

/* Platform admin */
import { AdminOverview } from '@/pages/admin/AdminOverview'
import { AdminTenants } from '@/pages/admin/AdminTenants'
import { AdminPlans } from '@/pages/admin/AdminPlans'
import { AdminSubscriptions } from '@/pages/admin/AdminSubscriptions'
import { AdminAnalytics } from '@/pages/admin/AdminAnalytics'
import { AdminAudit } from '@/pages/admin/AdminAudit'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

/** Gate authenticated areas; unauthenticated users land on the marketing site (prd.md §26). */
function Protected({ children }: { children: React.ReactNode }) {
  const { session, ready } = useAppStore()
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-space-md">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Restoring your session…
          </span>
        </div>
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AppStoreProvider>
      <ToastProvider>
        <CartProvider>
          <ScrollToTop />
          <Routes>
            {/* ---------------------------------------------------- Public */}
            <Route element={<MarketingLayout />}>
              <Route index element={<LandingPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/demo" element={<DemoPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
            </Route>

            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* ----------------------------------------------- Onboarding */}
            <Route path="/onboarding" element={<OnboardingFlow />} />
            <Route path="/onboarding/:step" element={<OnboardingFlow />} />

            {/* -------------------------------------------- Restaurant app */}
            <Route
              path="/app"
              element={
                <Protected>
                  <DashboardShell variant="app" />
                </Protected>
              }
            >
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="kitchen" element={<KitchenPage />} />
              <Route path="tables" element={<TablesPage />} />
              <Route path="tables/qr" element={<QrGeneratorPage />} />
              <Route path="reservations" element={<ReservationsPage />} />
              <Route path="menu" element={<MenuPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="branding" element={<BrandingPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* ------------------------------------------- Platform admin */}
            <Route
              path="/admin"
              element={
                <Protected>
                  <DashboardShell variant="admin" />
                </Protected>
              }
            >
              <Route index element={<AdminOverview />} />
              <Route path="tenants" element={<AdminTenants />} />
              <Route path="plans" element={<AdminPlans />} />
              <Route path="subscriptions" element={<AdminSubscriptions />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="audit" element={<AdminAudit />} />
            </Route>

            {/* -------------------------------------------- Customer (QR) */}
            <Route path="/r/:slug" element={<CustomerShell />}>
              <Route index element={<CustomerHome />} />
              <Route path="menu" element={<CustomerMenu />} />
              <Route path="menu/:itemId" element={<DishDetail />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="orders" element={<CustomerOrders />} />
              <Route path="order/:orderId" element={<OrderTracking />} />
              <Route path="bill" element={<BillPage />} />
              <Route path="profile" element={<CustomerProfile />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
      </ToastProvider>
    </AppStoreProvider>
  )
}
