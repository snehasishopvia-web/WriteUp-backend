import { Response } from "express";
import { CookieOptions } from "express";

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";
const USE_COOKIES = IS_PRODUCTION;

// Cookie configuration
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? "strict" : "lax",
  path: "/",
};

// Access token cookie options
const ACCESS_TOKEN_OPTIONS: CookieOptions = {
  ...COOKIE_OPTIONS,
  maxAge: 30 * 60 * 1000, // 30 minutes in milliseconds
};

// Refresh token cookie options
const REFRESH_TOKEN_OPTIONS: CookieOptions = {
  ...COOKIE_OPTIONS,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
};

/**
 * Check if cookies should be used based on environment
 */
export const shouldUseCookies = (): boolean => {
  return USE_COOKIES;
};

/**
 * Set access token cookie (only in production)
 */
export const setAccessTokenCookie = (res: Response, token: string): void => {
  if (USE_COOKIES) res.cookie("access_token", token, ACCESS_TOKEN_OPTIONS);
};

/**
 * Set refresh token cookie (only in production)
 */
export const setRefreshTokenCookie = (res: Response, token: string): void => {
  if (USE_COOKIES) res.cookie("refresh_token", token, REFRESH_TOKEN_OPTIONS);
};

/**
 * Set both access and refresh token cookies (only in production)
 */
export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
): void => {
  if (USE_COOKIES) {
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);
  }
};

/**
 * Clear access token cookie (only in production)
 */
export const clearAccessTokenCookie = (res: Response): void => {
  if (USE_COOKIES)
    res.clearCookie("access_token", { ...COOKIE_OPTIONS, maxAge: 0 });
};

/**
 * Clear refresh token cookie (only in production)
 */
export const clearRefreshTokenCookie = (res: Response): void => {
  if (USE_COOKIES)
    res.clearCookie("refresh_token", { ...COOKIE_OPTIONS, maxAge: 0 });
};

/**
 * Clear all authentication cookies (only in production)
 */
export const clearAuthCookies = (res: Response): void => {
  if (USE_COOKIES) {
    clearAccessTokenCookie(res);
    clearRefreshTokenCookie(res);
  }
};

/**
 * Get cookie configuration for custom use
 */
export const getCookieOptions = () => ({
  access: ACCESS_TOKEN_OPTIONS,
  refresh: REFRESH_TOKEN_OPTIONS,
  base: COOKIE_OPTIONS,
});
