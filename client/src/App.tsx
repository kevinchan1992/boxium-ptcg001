import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PageWrapper } from "./components/PageWrapper";
import Home from "./pages/Home";
import CardDetail from "./pages/CardDetail";
import SearchResults from "./pages/SearchResults";
import Research from "./pages/Research";
import Pricing from "./pages/Pricing";
import PricingSearch from "./pages/PricingSearch";
import PricingDetail from "./pages/PricingDetail";
import Admin from "./pages/Admin";
import AdminMarketplace from "./pages/AdminMarketplace";
import Marketplace from "./pages/Marketplace";
import MarketplaceListing from "./pages/MarketplaceListing";
import AuctionDetail from "./pages/AuctionDetail";
import AuctionTerms from "./pages/AuctionTerms";
import SellerDashboard from "./pages/SellerDashboard";
import Wishlist from "./pages/Wishlist";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Disclaimer from "./pages/Disclaimer";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ResendVerification from "./pages/ResendVerification";
import Profile from "./pages/Profile";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Grading from "./pages/Grading";
import GradingSubmit from "./pages/GradingSubmit";
import GradingOrders from "./pages/GradingOrders";
import GradingOrderDetail from "./pages/GradingOrderDetail";
import Notifications from "./pages/Notifications";
import SellerPublicProfile from "./pages/SellerPublicProfile";
import Cart from "./pages/Cart";
import Unsubscribe from "./pages/Unsubscribe";
import { TopNav } from "./components/TopNav";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";
import GradingMaintenanceGuard from "./components/GradingMaintenanceGuard";
import SellerCenterMaintenanceGuard from "./components/SellerCenterMaintenanceGuard";
import MessageCenter from "./components/MessageCenter";
import { trpc } from "./lib/trpc";





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
      <div className="pt-14">
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
      <Route path="/trending">
        <Redirect to="/" />
      </Route>

      <Route path="/pricing" component={Pricing} />
      <Route path="/pricing/search" component={PricingSearch} />
      <Route path="/pricing/:id" component={PricingDetail} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/resend-verification" component={ResendVerification} />
      <Route path="/profile" component={Profile} />

      <Route path="/admin">
        <ProtectedAdminRoute>
          <Admin />
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/marketplace">
        <ProtectedAdminRoute>
          <AdminMarketplace />
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
        <SellerCenterMaintenanceGuard><SellerDashboard /></SellerCenterMaintenanceGuard>
      </Route>
      <Route path="/orders">
        <Redirect to="/profile?tab=orders" />
      </Route>
      <Route path="/orders/:orderNo" component={OrderDetail} />
      <Route path="/grading">
        <GradingMaintenanceGuard><Grading /></GradingMaintenanceGuard>
      </Route>
      <Route path="/grading/submit">
        <GradingMaintenanceGuard><GradingSubmit /></GradingMaintenanceGuard>
      </Route>
      <Route path="/grading/orders">
        <GradingMaintenanceGuard><GradingOrders /></GradingMaintenanceGuard>
      </Route>
      <Route path="/grading/orders/:id">
        <GradingMaintenanceGuard><GradingOrderDetail /></GradingMaintenanceGuard>
      </Route>
      <Route path="/cart" component={Cart} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/seller/:id" component={SellerPublicProfile} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/disclaimer" component={Disclaimer} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/unsubscribe" component={Unsubscribe} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
        </Switch>
      </div>
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
