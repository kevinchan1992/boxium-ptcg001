import { useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

/**
 * Component that displays an alert when OAuth login fails
 * Checks for ?error=oauth_failed query parameter and shows appropriate message
 */
export function OAuthErrorToast() {
  const [location] = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const reason = params.get("reason");

    if (error === "oauth_failed") {
      let message = t("auth.loginFailedGeneric");
      
      if (reason === "missing_openid") {
        message = t("auth.loginFailedMissingInfo");
      } else if (reason === "callback_error") {
        message = t("auth.loginFailedCallback");
      }

      // Show alert to user
      alert(`${t("auth.loginFailed")}\n\n${message}`);

      // Clean up URL by removing error parameters
      params.delete("error");
      params.delete("reason");
      const newSearch = params.toString();
      const newUrl = location.split("?")[0] + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, [location, t]);

  return null;
}
