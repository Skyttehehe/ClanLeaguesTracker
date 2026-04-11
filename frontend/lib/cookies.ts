const KEYS = {
  clan: "clan",
  username: "username",
} as const;

const storage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

export const getClanCookie = (): string | undefined => {
  return storage()?.getItem(KEYS.clan) ?? undefined;
};

export const getUsernameCookie = (): string | undefined => {
  return storage()?.getItem(KEYS.username) ?? undefined;
};

export const setLoginCookies = (clan: string, username: string): void => {
  storage()?.setItem(KEYS.clan, clan);
  storage()?.setItem(KEYS.username, username);
};

export const clearLoginCookies = (): void => {
  storage()?.removeItem(KEYS.clan);
  storage()?.removeItem(KEYS.username);
};

export const isLoggedIn = (): boolean => {
  return Boolean(getClanCookie() && getUsernameCookie());
};
