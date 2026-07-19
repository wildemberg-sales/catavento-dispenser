import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Role, UserDTO } from "@catavento/contracts/users";
import { useAuth } from "../../auth/AuthContext";
import { createUsersApi } from "../../api/users.api";
import { ApiClientError } from "../../api/client";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

const ROLES: Role[] = ["admin", "operator"];

export function UsersListScreen() {
  const { apiClient, user: currentUser } = useAuth();
  const usersApi = useMemo(() => createUsersApi(apiClient), [apiClient]);
  const navigate = useNavigate();

  const [roleFilter, setRoleFilter] = useState<"" | Role>("");
  const [statusFilter, setStatusFilter] = useState<"" | "true" | "false">("");
  const [users, setUsers] = useState<UserDTO[] | null>(null);
  const [editedDisplayNames, setEditedDisplayNames] = useState<Record<string, string>>({});
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  function handleDisplayNameChange(id: string, value: string) {
    setEditedDisplayNames((current) => ({ ...current, [id]: value }));
  }

  async function handleSaveDisplayName(id: string) {
    const displayName = editedDisplayNames[id];
    if (displayName === undefined) return;
    await usersApi.update(id, { displayName });
    refresh();
  }

  async function handleRoleChange(id: string, role: Role) {
    await usersApi.update(id, { role });
    refresh();
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    await usersApi.update(id, { isActive });
    refresh();
  }

  async function handleResetPassword(id: string) {
    setError(null);
    try {
      await usersApi.resetPassword(id, { newPassword });
      setResettingId(null);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível redefinir a senha.");
    }
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

      {error ? <p style={styles.error}>{error}</p> : null}

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
                <td>
                  <div style={styles.displayNameCell}>
                    <input
                      data-testid={`displayname-input-${row.id}`}
                      className="field"
                      type="text"
                      value={editedDisplayNames[row.id] ?? row.displayName}
                      onChange={(event) => handleDisplayNameChange(row.id, event.target.value)}
                    />
                    <button
                      data-testid={`save-displayname-${row.id}`}
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleSaveDisplayName(row.id)}
                    >
                      Salvar
                    </button>
                  </div>
                </td>
                <td>
                  <select
                    data-testid={`role-select-${row.id}`}
                    className="field"
                    value={row.role}
                    onChange={(event) => handleRoleChange(row.id, event.target.value as Role)}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
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
                    {resettingId === row.id ? (
                      <div style={styles.resetRow}>
                        <input
                          data-testid={`reset-password-input-${row.id}`}
                          className="field"
                          type="password"
                          placeholder="Nova senha"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                        />
                        <button
                          data-testid={`reset-password-confirm-${row.id}`}
                          className="btn btn-primary btn-sm"
                          onClick={() => handleResetPassword(row.id)}
                        >
                          Confirmar
                        </button>
                      </div>
                    ) : (
                      <button
                        data-testid={`reset-password-${row.id}`}
                        className="btn btn-ghost btn-sm"
                        onClick={() => setResettingId(row.id)}
                      >
                        Redefinir senha
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
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
  error: { ...typography.label, color: colors.danger, margin: 0 },
  strong: { fontWeight: 600, color: colors.text },
  displayNameCell: { display: "flex", gap: 6, alignItems: "center" },
  actionsCell: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  resetRow: { display: "flex", gap: 6, alignItems: "center" },
};
