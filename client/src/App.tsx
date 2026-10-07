import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider } from "./contexts/AuthContext";
import Home from "./pages/Home";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import { useAuth } from "./_core/hooks/useAuth";

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      {/* 
        Self-contained Demo Authentication Guard:
        - When unauthenticated: App opens directly to Login / Signup screen.
        - Operational functionality and role dashboards are NOT exposed before login.
        - When authenticated: App opens to the active role dashboard.
      */}
      <Route path="/">
        {isAuthenticated ? <Home /> : <Login defaultMode="login" />}
      </Route>
      <Route path="/signup">
        {isAuthenticated ? <Home /> : <Signup />}
      </Route>
      <Route path="/login">
        {isAuthenticated ? <Home /> : <Login defaultMode="login" />}
      </Route>
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <LanguageProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
