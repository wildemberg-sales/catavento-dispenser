import { z } from "zod";
import { roleSchema } from "../users/schemas.js";

export const loginInputSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const refreshInputSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshInputSchema>;

export const logoutInputSchema = z.object({
  refreshToken: z.string().min(1),
});
export type LogoutInput = z.infer<typeof logoutInputSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  role: roleSchema,
  displayName: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: authUserSchema,
});
export type TokenPair = z.infer<typeof tokenPairSchema>;
