import type { Env } from "./env";
import type { Identity } from "./services/identity";
import type { GuestResolution } from "./middleware/identity";

/** Hono environment for every /api route: bindings + per-request variables. */
export type AppEnv = {
  Bindings: Env;
  Variables: {
    identity: Identity;
    /** Raw guest-cookie resolution outcome — guest routes branch on it. */
    guestResolution: GuestResolution;
  };
};
