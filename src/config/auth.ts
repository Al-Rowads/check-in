export type UserRole = "admin" | "user";

export type StaticUser = {
  username: string;
  password: string;
  role: UserRole;
};

export const STATIC_USERS: StaticUser[] = [
  {
    username: "admin",
    password: "checkin2026",
    role: "admin",
  },
  {
    username: "user",
    password: "user2026",
    role: "user",
  },
];

export const ADMIN_CREDENTIALS = STATIC_USERS[0] as StaticUser;

export const AUTH_STORAGE_KEY = "event-check-in:auth-session";
