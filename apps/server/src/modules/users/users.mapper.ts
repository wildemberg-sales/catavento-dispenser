import type { UserDTO } from "@catavento/contracts/users";

type UserRow = {
  id: string;
  username: string;
  role: "admin" | "operator";
  displayName: string;
  isActive: boolean;
  createdAt: Date;
};

export function toUserDto(row: UserRow): UserDTO {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    displayName: row.displayName,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}
