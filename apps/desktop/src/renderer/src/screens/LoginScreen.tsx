import React, { useState } from "react";
import { useAuth, ForbiddenRoleError } from "../auth/AuthContext";
import { ApiClientError } from "../api/client";
import { Button } from "../components/Button";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Usuário e senha são obrigatórios.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      if (err instanceof ApiClientError || err instanceof ForbiddenRoleError) {
        setError(err.message);
      } else {
        setError("Não foi possível entrar.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.container}>
      <div className="card fade-in" style={styles.card}>
        <span style={styles.badge}>🎂</span>
        <h1 style={styles.title}>Catavento Gerência</h1>
        <p style={styles.subtitle}>Entre com sua conta de administrador</p>
        <form style={styles.form} onSubmit={handleSubmit}>
          <input
            data-testid="login-username"
            className="field"
            placeholder="Usuário"
            autoCapitalize="none"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <input
            data-testid="login-password"
            className="field"
            placeholder="Senha"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <p style={styles.error}>{error}</p> : null}
          <Button data-testid="login-submit" type="submit" disabled={submitting} style={{ width: "100%" }}>
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    padding: 24,
    background: `radial-gradient(circle at 20% 15%, ${colors.surfaceAlt} 0%, ${colors.background} 45%)`,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    width: "100%",
    maxWidth: 360,
    padding: "36px 32px",
  },
  badge: {
    fontSize: 34,
    width: 64,
    height: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    backgroundColor: colors.surfaceAlt,
    marginBottom: 12,
  },
  title: {
    ...typography.title,
    color: colors.secondary,
    margin: 0,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    margin: "4px 0 20px",
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
  },
  error: {
    ...typography.label,
    color: colors.danger,
    margin: 0,
    textAlign: "center",
  },
};
