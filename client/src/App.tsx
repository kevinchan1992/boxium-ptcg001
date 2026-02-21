import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
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
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Disclaimer from "./pages/Disclaimer";
import About from "./pages/About";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Favorites from "./pages/Favorites";
import { TopNav } from "./components/TopNav";
import { AdminRoute } from "./components/AdminRoute";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { OAuthErrorToast } from "./components/OAuthErrorToast";
import { GenerateArticle } from "./pages/GenerateArticle";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";





function Router() {
  return (
    <PageWrapper>
      <OAuthErrorToast />
      <TopNav />
      <div className="pt-16">
        <Switch>
      <Route path={"/"} component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/profile" component={Profile} />
      <Route path="/search" component={SearchResults} />
      <Route path="/card/:id" component={CardDetail} />
      <Route path="/research" component={Research} />
      <Route path="/trending" component={Trending} />

      <Route path="/pricing" component={Pricing} />
      <Route path="/pricing/search" component={PricingSearch} />
      <Route path="/pricing/:id" component={PricingDetail} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />

      <Route path="/favorites">
        <ProtectedRoute>
          <Favorites />
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/admin">
        <AdminRoute>
          <Admin />
        </AdminRoute>
      </Route>
      <Route path="/admin/generate-article">
        <AdminRoute>
          <GenerateArticle />
        </AdminRoute>
      </Route>
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
