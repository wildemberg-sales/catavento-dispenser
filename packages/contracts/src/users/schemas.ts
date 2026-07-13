import { z } from "zod";
import { paginationQuerySchema } from "../common/pagination.js";

export const roleSchema = z.enum(["admin", "operator"]);
export type Role = z.infer<typeof roleSchema>;

export const userDtoSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  role: roleSchema,
  displayName: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});
export type UserDTO = z.infer<typeof userDtoSchema>;

export const createUserInputSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  role: roleSchema,
  displayName: z.string().min(1),
});
export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = z
  .object({
    displayName: z.string().min(1).optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

export const resetPasswordInputSchema = z.object({
  newPassword: z.string().min(8),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;

// z.coerce.boolean() converteria a string "false" para `true` (qualquer
// string não vazia é truthy em JS) — por isso o parse explícito abaixo.
const booleanQueryParam = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((v) => (typeof v === "boolean" ? v : v === "true"));

export const listUsersQuerySchema = z
  .object({
    role: roleSchema.optional(),
    isActive: booleanQueryParam.optional(),
  })
  .merge(paginationQuerySchema);
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
