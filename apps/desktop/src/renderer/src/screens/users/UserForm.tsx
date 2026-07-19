import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Role } from "@catavento/contracts/users";
import { useAuth } from "../../auth/AuthContext";
import { createUsersApi } from "../../api/users.api";
import { ApiClientError } from "../../api/client";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

export function UserForm() {
  const { apiClient } = useAuth();
  const usersApi = useMemo(() => createUsersApi(apiClient), [apiClient]);
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("operator");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await usersApi.create({ username, password, displayName, role });
      navigate("/users");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível criar o usuário.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.container}>
      <PageHeader title="Novo usuário" subtitle="Cadastre um administrador ou operador" />

      <Card style={styles.formCard}>
        <form style={styles.form} onSubmit={handleSubmit}>
          <label style={styles.label}>
            Usuário
            <input
              data-testid="user-username"
              className="field"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <label style={styles.label}>
            Senha
            <input
              data-testid="user-password"
              className="field"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <label style={styles.label}>
            Nome de exibição
            <input
              data-testid="user-displayname"
              className="field"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>

          <label style={styles.label}>
            Papel
            <select
              data-testid="user-role"
              className="field"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              <option value="operator">operator</option>
              <option value="admin">admin</option>
            </select>
          </label>

          {error ? <p style={styles.error}>{error}</p> : null}

          <Button data-testid="user-submit" type="submit" disabled={submitting} style={{ alignSelf: "flex-start" }}>
            Criar usuário
          </Button>
        </form>
      </Card>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 20 },
  formCard: { padding: 24, maxWidth: 480 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  label: { ...typography.label, color: colors.text, display: "flex", flexDirection: "column", gap: 6 },
  error: { ...typography.label, color: colors.danger, margin: 0 },
};
