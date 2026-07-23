import React, { useState } from "react";
import type { Role, UserDTO } from "@catavento/contracts/users";
import { ApiClientError } from "../../api/client";
import type { UsersApi } from "../../api/users.api";
import { Modal } from "../../components/Modal";
import { Button } from "../../components/Button";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

const ROLES: Role[] = ["admin", "operator"];

export function UserEditModal({
  user,
  usersApi,
  onClose,
  onSuccess,
}: {
  user: UserDTO;
  usersApi: Pick<UsersApi, "update" | "resetPassword">;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState<Role>(user.role);
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await usersApi.update(user.id, { displayName, role });
      if (newPassword.trim() !== "") {
        await usersApi.resetPassword(user.id, { newPassword });
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível salvar as alterações.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Editar ${user.username}`} onClose={onClose}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <label style={styles.label}>
          Nome de exibição
          <input
            data-testid="edit-user-displayname"
            className="field"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>

        <label style={styles.label}>
          Papel
          <select
            data-testid="edit-user-role"
            className="field"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Nova senha
          <input
            data-testid="edit-user-password"
            className="field"
            type="password"
            placeholder="Deixe em branco para manter a senha atual"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>

        {error ? <p style={styles.error}>{error}</p> : null}

        <div style={styles.actions}>
          <Button data-testid="edit-user-cancel" type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button data-testid="edit-user-submit" type="submit" disabled={submitting}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: "flex", flexDirection: "column", gap: 16 },
  label: { ...typography.label, color: colors.text, display: "flex", flexDirection: "column", gap: 6 },
  error: { ...typography.label, color: colors.danger, margin: 0 },
  actions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 },
};
