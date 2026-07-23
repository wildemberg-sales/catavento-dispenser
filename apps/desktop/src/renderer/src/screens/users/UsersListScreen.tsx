import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Role, UserDTO } from "@catavento/contracts/users";
import { useAuth } from "../../auth/AuthContext";
import { createUsersApi } from "../../api/users.api";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { UserEditModal } from "./UserEditModal";

const ROLES: Role[] = ["admin", "operator"];

export function UsersListScreen() {
  const { apiClient, user: currentUser } = useAuth();
  const usersApi = useMemo(() => createUsersApi(apiClient), [apiClient]);
  const navigate = useNavigate();

  const [roleFilter, setRoleFilter] = useState<"" | Role>("");
  const [statusFilter, setStatusFilter] = useState<"" | "true" | "false">("");
  const [users, setUsers] = useState<UserDTO[] | null>(null);
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);

  const refresh = useCallback(() => {
    const params: { role?: Role; isActive?: boolean } = {};
    if (roleFilter) params.role = roleFilter;
    if (statusFilter) params.isActive = statusFilter === "true";
    usersApi.list(params).then((result) => setUsers(result.items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersApi, roleFilter, statusFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleToggleActive(id: string, isActive: boolean) {
    await usersApi.update(id, { isActive });
    refresh();
  }

  function handleUserSaved() {
    setEditingUser(null);
    refresh();
  }

  return (
    <div style={styles.container}>
      <PageHeader
        title="Usuários"
        subtitle="Administradores e operadores com acesso ao sistema"
        action={
          <Button data-testid="new-user-button" onClick={() => navigate("/users/new")}>
            + Novo usuário
          </Button>
        }
      />

      <Card style={styles.filterCard}>
        <label style={styles.filterLabel}>
          Papel
          <select
            data-testid="role-filter"
            className="field"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as "" | Role)}
          >
            <option value="">Todos</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label style={styles.filterLabel}>
          Status
          <select
            data-testid="status-filter"
            className="field"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "" | "true" | "false")}
          >
            <option value="">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </label>
      </Card>

      <Card className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Nome</th>
              <th>Papel</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((row) => (
              <tr key={row.id}>
                <td style={styles.strong}>{row.username}</td>
                <td>{row.displayName}</td>
                <td>{row.role}</td>
                <td>
                  <span
                    className="badge"
                    style={{
                      color: row.isActive ? colors.success : colors.textMuted,
                      backgroundColor: row.isActive ? colors.successSoft : colors.neutralSoft,
                    }}
                  >
                    {row.isActive ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td>
                  <div style={styles.actionsCell}>
                    <button
                      data-testid={`edit-${row.id}`}
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditingUser(row)}
                    >
                      Editar
                    </button>
                    {row.isActive && row.id !== currentUser?.id ? (
                      <button
                        data-testid={`deactivate-${row.id}`}
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleToggleActive(row.id, false)}
                      >
                        Desativar
                      </button>
                    ) : null}
                    {!row.isActive ? (
                      <button
                        data-testid={`reactivate-${row.id}`}
                        className="btn btn-primary btn-sm"
                        onClick={() => handleToggleActive(row.id, true)}
                      >
                        Reativar
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editingUser ? (
        <UserEditModal
          user={editingUser}
          usersApi={usersApi}
          onClose={() => setEditingUser(null)}
          onSuccess={handleUserSaved}
        />
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 20 },
  filterCard: { padding: 16, display: "flex", flexWrap: "wrap", gap: 20 },
  filterLabel: {
    ...typography.label,
    color: colors.text,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  strong: { fontWeight: 600, color: colors.text },
  actionsCell: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
};
