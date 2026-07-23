import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

const navItems = [
  { to: "/imports", label: "Importações", icon: "📥" },
  { to: "/queue", label: "Fila", icon: "🎂" },
  { to: "/products", label: "Produtos", icon: "🧁" },
  { to: "/reconciliation", label: "Sem vínculo", icon: "🔗" },
  { to: "/monitor", label: "Monitor", icon: "📡" },
  { to: "/reports", label: "Relatórios", icon: "📊" },
  { to: "/users", label: "Usuários", icon: "👤" },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const initial = user?.displayName?.trim().charAt(0).toUpperCase() ?? "?";

  return (
    <div style={styles.container}>
      <nav className="app-sidebar" style={styles.sidebar}>
        <div className="app-brand" style={styles.brand}>
          <span style={styles.brandBadge}>🌀</span>
          <span className="app-shell-label">Catavento</span>
        </div>

        <div style={styles.navGroup}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span className="app-shell-label">{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div style={styles.spacer} />

        {user ? (
          <div className="app-user-card" style={styles.userCard} title={user.displayName}>
            <span style={styles.userAvatar}>{initial}</span>
            <div className="app-shell-label" style={styles.userMeta}>
              <span style={styles.userName}>{user.displayName}</span>
              <span style={styles.userRole}>Administrador</span>
            </div>
          </div>
        ) : null}
        <Button
          data-testid="logout-btn"
          variant="secondary"
          size="sm"
          title="Sair"
          style={{ width: "100%" }}
          onClick={() => void logout()}
        >
          <span aria-hidden="true">🚪</span>
          <span className="app-shell-label">Sair</span>
        </Button>
      </nav>
      <main className="app-content" style={styles.content}>
        <div className="fade-in" style={styles.contentInner}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    height: "100vh",
    backgroundColor: colors.background,
  },
  // width/minWidth/padding vêm da classe .app-sidebar (theme/global.css) —
  // não aqui, pra que o media query de sidebar colapsada consiga sobrescrever
  // (um estilo inline sempre vence uma regra de CSS não-!important).
  sidebar: {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    gap: 6,
    background: `linear-gradient(180deg, ${colors.secondary} 0%, #0f2338 100%)`,
    position: "sticky",
    top: 0,
    height: "100vh",
    overflowY: "auto",
  },
  brand: {
    ...typography.title,
    color: colors.textOnDark,
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
    paddingLeft: 4,
  },
  brandBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "rgba(251, 239, 228, 0.12)",
    fontSize: 17,
  },
  navGroup: { display: "flex", flexDirection: "column", gap: 4 },
  spacer: {
    flex: 1,
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 10px",
    borderRadius: 14,
    backgroundColor: "rgba(251, 239, 228, 0.06)",
    marginBottom: 10,
  },
  userAvatar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: "50%",
    backgroundColor: colors.primary,
    color: colors.textOnDark,
    fontWeight: 700,
    fontSize: 13,
    flexShrink: 0,
  },
  userMeta: { display: "flex", flexDirection: "column", minWidth: 0 },
  userName: {
    ...typography.label,
    color: colors.textOnDark,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  userRole: { ...typography.small, color: "rgba(251, 239, 228, 0.6)" },
  // padding vem da classe .app-content (mesmo motivo do sidebar acima).
  content: {
    flex: 1,
    minWidth: 0,
    overflow: "auto",
  },
  contentInner: {
    maxWidth: 1120,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
};
