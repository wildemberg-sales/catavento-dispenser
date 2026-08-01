import type { UserDTO, CreateUserInput, UpdateUserInput, ResetPasswordInput, ListUsersQuery } from "@catavento/contracts/users";
import type { Paginated } from "@catavento/contracts/common";
import type { ApiClient } from "./client";
import { buildQueryString } from "./queryString";

export function createUsersApi(client: ApiClient) {
  return {
    list(params: Partial<ListUsersQuery> = {}): Promise<Paginated<UserDTO>> {
      return client.request(`/admin/users${buildQueryString(params)}`);
    },

    create(input: CreateUserInput): Promise<UserDTO> {
      return client.request("/admin/users", { method: "POST", body: input });
    },

    update(id: string, input: UpdateUserInput): Promise<UserDTO> {
      return client.request(`/admin/users/${id}`, { method: "PUT", body: input });
    },

    resetPassword(id: string, input: ResetPasswordInput): Promise<void> {
      return client.request(`/admin/users/${id}/reset-password`, { method: "POST", body: input });
    },
  };
}

export type UsersApi = ReturnType<typeof createUsersApi>;
