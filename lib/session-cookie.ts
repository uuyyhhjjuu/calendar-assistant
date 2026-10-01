export const SESSION_COOKIE_NAME = "calendar_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function getSessionCookieOptions(secure: boolean, maxAge = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function getClearedSessionCookie(secure: boolean) {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    options: getSessionCookieOptions(secure, 0),
  };
}
