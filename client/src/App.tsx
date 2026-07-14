import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect, useLocation } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PageWrapper } from "./components/PageWrapper";
import { TopNav } from "./components/TopNav";
import { BottomTabBar } from "./components/BottomTabBar";
import { PageTransition } from "./components/PageTransition";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";
import { trpc } from "./lib/trpc";
import MessageCenter from "./components/MessageCenter";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";

// Eagerly loaded pages (critical path)
import NotFound from "./pages/NotFound";

// Lazily loaded pages (code-split per route)
const Home = lazy(() => import("./pages/Home"));
const CardDetail = lazy(() => import("./pages/CardDetail"));
const SearchResults = lazy(() => import("./pages/SearchResults"));
const Research = lazy(() => import("./pages/Research"));
const Pricing = lazy(() => import("./pages/Pricing"));
const PricingSearch = lazy(() => import("./pages/PricingSearch"));
const PricingDetail = lazy(() => import("./pages/PricingDetail"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminMarketplace = lazy(() => import("./pages/AdminMarketplace"));
const DesignSystem = lazy(() => import("./pages/DesignSystem"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const MarketplaceListing = lazy(() => import("./pages/MarketplaceListing"));
const AuctionDetail = lazy(() => import("./pages/AuctionDetail"));
const AuctionTerms = lazy(() => import("./pages/AuctionTerms"));
const SellerDashboard = lazy(() => import("./pages/SellerDashboard"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Disclaimer = lazy(() => import("./pages/Disclaimer"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ResendVerification = lazy(() => import("./pages/ResendVerification"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const Grading = lazy(() => import("./pages/Grading"));
const GradingSubmit = lazy(() => import("./pages/GradingSubmit"));
const GradingOrders = lazy(() => import("./pages/GradingOrders"));
const GradingOrderDetail = lazy(() => import("./pages/GradingOrderDetail"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Trending = lazy(() => import("./pages/Trending"));
const SellerPublicProfile = lazy(() => import("./pages/SellerPublicProfile"));
const Cart = lazy(() => import("./pages/Cart"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const SetBrowse = lazy(() => import("./pages/SetBrowse"));
const SetList = lazy(() => import("./pages/SetList"));
const PoolAdmin = lazy(() => import("./pages/admin/PoolAdmin"));
const Pools = lazy(() => import("./pages/Pools"));
const PoolDetail = lazy(() => import("./pages/PoolDetail"));
const Points = lazy(() => import("./pages/Points"));
const Vault = lazy(() => import("./pages/Vault"));

// Lazily loaded guard components
const GradingMaintenanceGuard = lazy(() => import("./components/GradingMaintenanceGuard"));
const SellerCenterMaintenanceGuard = lazy(() => import("./components/SellerCenterMaintenanceGuard"));

// Page loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Router() {
  const [location] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <PageWrapper>
      <TopNav />
      {user && <MessageCenter />}
      <div className="pt-14 pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pb-0">
        <PageTransition>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path={"/"} component={Home} />

            <Route path="/search" component={SearchResults} />
            <Route path="/card/:id">
              {() => <CardDetail />}
            </Route>
            <Route path="/sealed-product/:id">
              {(params: { id?: string }) => {
                const id = params?.id;
                if (!id) return <NotFound />;
                return <CardDetail sealedProductId={parseInt(id, 10)} />;
              }}
            </Route>
            <Route path="/research" component={Research} />
            <Route path="/trending" component={Trending} />

            <Route path="/pricing" component={Pricing} />
            <Route path="/pricing/search" component={PricingSearch} />
            <Route path="/pricing/:id" component={PricingDetail} />
            <Route path="/sets" component={SetList} />
            <Route path="/set/:setCode" component={SetBrowse} />
            <Route path="/blog" component={Blog} />
            <Route path="/blog/:slug" component={BlogPost} />
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/verify-email" component={VerifyEmail} />
            <Route path="/resend-verification" component={ResendVerification} />
            <Route path="/reset-password" component={ResetPassword} />
            <Route path="/profile" component={Profile} />
            <Route path="/vault" component={Vault} />

            <Route path="/admin">
              <ProtectedAdminRoute>
                <Suspense fallback={<PageLoader />}>
                  <Admin />
                </Suspense>
              </ProtectedAdminRoute>
            </Route>
            <Route path="/admin/marketplace">
              <ProtectedAdminRoute>
                <Suspense fallback={<PageLoader />}>
                  <AdminMarketplace />
                </Suspense>
              </ProtectedAdminRoute>
            </Route>
            <Route path="/admin/design-system">
              <ProtectedAdminRoute>
                <Suspense fallback={<PageLoader />}>
                  <DesignSystem />
                </Suspense>
              </ProtectedAdminRoute>
            </Route>
            <Route path="/admin/pools">
              <ProtectedAdminRoute>
                <Suspense fallback={<PageLoader />}>
                  <PoolAdmin />
                </Suspense>
              </ProtectedAdminRoute>
            </Route>
            <Route path="/marketplace" component={Marketplace} />
            <Route path="/marketplace/:id" component={MarketplaceListing} />
            <Route path="/auction/terms" component={AuctionTerms} />
            <Route path="/auction/:id" component={AuctionDetail} />
            {/* /shop/:id is an alias for /marketplace/:id */}
            <Route path="/shop/:id">
              {(params: { id?: string }) => {
                const id = params?.id;
                if (!id) return <NotFound />;
                return <Redirect to={`/marketplace/${id}`} />;
              }}
            </Route>
            <Route path="/wishlist" component={Wishlist} />
            <Route path="/seller">
              <Suspense fallback={<PageLoader />}>
                <SellerCenterMaintenanceGuard>
                  <SellerDashboard />
                </SellerCenterMaintenanceGuard>
              </Suspense>
            </Route>
            <Route path="/orders">
              <Redirect to="/profile?tab=orders" />
            </Route>
            <Route path="/orders/:orderNo" component={OrderDetail} />
            <Route path="/grading">
              <Suspense fallback={<PageLoader />}>
                <GradingMaintenanceGuard>
                  <Grading />
                </GradingMaintenanceGuard>
              </Suspense>
            </Route>
            <Route path="/grading/submit">
              <Suspense fallback={<PageLoader />}>
                <GradingMaintenanceGuard>
                  <GradingSubmit />
                </GradingMaintenanceGuard>
              </Suspense>
            </Route>
            <Route path="/grading/orders">
              <Suspense fallback={<PageLoader />}>
                <GradingMaintenanceGuard>
                  <GradingOrders />
                </GradingMaintenanceGuard>
              </Suspense>
            </Route>
            <Route path="/grading/orders/:id">
              <Suspense fallback={<PageLoader />}>
                <GradingMaintenanceGuard>
                  <GradingOrderDetail />
                </GradingMaintenanceGuard>
              </Suspense>
            </Route>
            <Route path="/cart" component={Cart} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/seller/:id" component={SellerPublicProfile} />
            <Route path="/terms" component={Terms} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/disclaimer" component={Disclaimer} />
            <Route path="/about" component={About} />
            <Route path="/contact" component={Contact} />
            <Route path="/pools" component={Pools} />
            <Route path="/pools/:id" component={PoolDetail} />
            <Route path="/points" component={Points} />
            <Route path="/unsubscribe" component={Unsubscribe} />
            <Route path={"/404"} component={NotFound} />
            {/* Final fallback route */}
            <Route component={NotFound} />
          </Switch>
        </Suspense>
        </PageTransition>
      </div>
      <BottomTabBar />
      <PwaInstallPrompt />
    </PageWrapper>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
