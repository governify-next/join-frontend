export const env = {
  AUTHENTICATOR_SERVICE_URL:
    process.env.AUTHENTICATOR_SERVICE_URL || "http://localhost:5900",
  JOIN_BACKEND_URL: process.env.JOIN_BACKEND_URL || "http://localhost:5907",
  ACCESS_COOKIE:
    process.env.AUTH_ACCESS_COOKIE_NAME || "governify_next_access_token",
  REFRESH_COOKIE:
    process.env.AUTH_REFRESH_COOKIE_NAME || "governify_next_refresh_token",
  ACCESS_MAX_AGE: Number(process.env.ACCESS_TOKEN_MAX_AGE || 15 * 60),
  REFRESH_MAX_AGE: Number(
    process.env.REFRESH_TOKEN_MAX_AGE || 7 * 24 * 60 * 60,
  ),
};
