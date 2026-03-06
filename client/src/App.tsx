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
import Trending from "./pages/Trending";
import Pricing from "./pages/Pricing";
import PricingSearch from "./pages/PricingSearch";
import PricingDetail from "./pages/PricingDetail";
import Admin from "./pages/Admin";
import AdminMarketplace from "./pages/AdminMarketplace";
import Marketplace from "./pages/Marketplace";
import MarketplaceListing from "./pages/MarketplaceListing";
import SellerDashboard from "./pages/SellerDashboard";
import Wishlist from "./pages/Wishlist";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Disclaimer from "./pages/Disclaimer";
import About from "./pages/About";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import DebugBlog from "./pages/DebugBlog";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Notifications from "./pages/Notifications";
import SellerPublicProfile from "./pages/SellerPublicProfile";
import { TopNav } from "./components/TopNav";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";





function Router() {
  const [location] = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <PageWrapper>
      <TopNav />
      <div className="pt-16">
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
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/debug-blog" component={DebugBlog} />

      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
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
      <Route path="/wishlist" component={Wishlist} />
      <Route path="/seller" component={SellerDashboard} />
      <Route path="/orders" component={Orders} />
      <Route path="/orders/:orderNo" component={OrderDetail} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/seller/:id" component={SellerPublicProfile} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/disclaimer" component={Disclaimer} />
      <Route path="/about" component={About} />
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
