import { useEffect } from "react";
import { useLocation } from "wouter";

// Google Analytics 4 Measurement ID
// This will be injected via environment variable
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export function GoogleAnalytics() {
  const [location] = useLocation();

  useEffect(() => {
    // Only load GA if measurement ID is provided
    if (!GA_MEASUREMENT_ID) {
      console.warn("Google Analytics Measurement ID not found");
      return;
    }

    // Load Google Analytics script
    const script1 = document.createElement("script");
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script1);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer?.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: location,
    });

    return () => {
      // Cleanup scripts on unmount
      document.head.removeChild(script1);
    };
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (!GA_MEASUREMENT_ID || !window.gtag) return;

    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: location,
    });
  }, [location]);

  return null;
}

// Helper function to track custom events
export function trackEvent(
  eventName: string,
  eventParams?: Record<string, any>
) {
  if (!GA_MEASUREMENT_ID || !window.gtag) {
    console.warn("Google Analytics not initialized");
    return;
  }

  window.gtag("event", eventName, eventParams);
}

// Common event tracking functions
export const analytics = {
  // Track language change
  trackLanguageChange: (language: string) => {
    trackEvent("language_change", {
      language,
      timestamp: new Date().toISOString(),
    });
  },

  // Track card click
  trackCardClick: (cardId: number, cardName: string, source: string) => {
    trackEvent("card_click", {
      card_id: cardId,
      card_name: cardName,
      source,
    });
  },

  // Track search
  trackSearch: (searchQuery: string, resultCount: number) => {
    trackEvent("search", {
      search_term: searchQuery,
      result_count: resultCount,
    });
  },

  // Track trending tab change
  trackTrendingTabChange: (tabName: string) => {
    trackEvent("trending_tab_change", {
      tab_name: tabName,
    });
  },

  // Track external link click
  trackExternalLink: (url: string, linkText: string) => {
    trackEvent("external_link_click", {
      url,
      link_text: linkText,
    });
  },
};
