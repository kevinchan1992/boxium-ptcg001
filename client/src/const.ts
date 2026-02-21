// Re-export shared constants
export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Authentication routes
export const AUTH_ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  PROFILE: '/profile',
} as const;
