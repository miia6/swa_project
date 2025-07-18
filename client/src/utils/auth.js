import { createAuthClient } from "better-auth/svelte";

export const authClient = createAuthClient({
  baseUrl: "http://localhost:8000/api/auth",
});