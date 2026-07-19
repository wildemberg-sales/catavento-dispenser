import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ProductDTO } from "@catavento/contracts/products";
import { useAuth } from "../../auth/AuthContext";
import { createProductsApi } from "../../api/products.api";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

function firstImageUrl(product: ProductDTO): string | null {
  if (product.images.length === 0) return null;
  return [...product.images].sort((a, b) => a.position - b.position)[0]!.url;
}

export function ProductsListScreen() {
  const { apiClient } = useAuth();
  const productsApi = useMemo(() => createProductsApi(apiClient), [apiClient]);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [products, setProducts] = useState<ProductDTO[] | null>(null);

  const refresh = useCallback(() => {
    const params: { search?: string; includeInactive?: boolean } = { includeInactive };
    if (search.trim()) params.search = search.trim();
    productsApi.list(params).then((result) => setProducts(result.items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsApi, search, includeInactive]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleDeactivate(id: string) {
    await productsApi.deactivate(id);
    refresh();
  }

  async function handleReactivate(id: string) {
    await productsApi.reactivate(id);
    refresh();
  }

  return (
    <div style={styles.container}>
      <PageHeader
        title="Produtos"
        subtitle="Catálogo de bolos fake, com fotos e itens de montagem"
        action={
          <Button data-testid="new-product-button" onClick={() => navigate("/products/new")}>
            + Novo produto
          </Button>
        }
      />

      <Card style={styles.filterCard}>
        <label style={styles.filterLabel}>
          Buscar
          <input
            data-testid="products-search"
            className="field"
            type="text"
            placeholder="Nome ou SKU"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label style={styles.toggleLabel}>
          <input
            data-testid="include-inactive-toggle"
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          Incluir inativos
        </label>
      </Card>

      {products === null ? null : products.length === 0 ? (
        <Card style={styles.emptyState}>
          <span style={styles.emptyIcon}>🎂</span>
          <p style={styles.emptyText}>Nenhum produto cadastrado ainda.</p>
          <p style={styles.emptyHint}>Cadastre o primeiro bolo fake com fotos e itens de montagem.</p>
        </Card>
      ) : (
        <Card className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Nome</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const imageUrl = firstImageUrl(product);
                return (
                  <tr key={product.id}>
                    <td>
                      {imageUrl ? (
                        <img src={imageUrl} alt={product.name} style={styles.thumbnail} />
                      ) : (
                        <span style={styles.thumbnailPlaceholder}>🎂</span>
                      )}
                    </td>
                    <td
                      style={styles.nameCell}
                      onClick={() => navigate(`/products/${product.id}/edit`)}
                    >
                      {product.name}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          color: product.isActive ? colors.success : colors.textMuted,
                          backgroundColor: product.isActive ? colors.successSoft : colors.neutralSoft,
                        }}
                      >
                        {product.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      {product.isActive ? (
                        <button
                          data-testid={`deactivate-${product.id}`}
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDeactivate(product.id)}
                        >
                          Desativar
                        </button>
                      ) : (
                        <button
                          data-testid={`reactivate-${product.id}`}
                          className="btn btn-primary btn-sm"
                          onClick={() => handleReactivate(product.id)}
                        >
                          Reativar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 20 },
  filterCard: { padding: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20 },
  filterLabel: {
    ...typography.label,
    color: colors.text,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 220,
  },
  toggleLabel: {
    ...typography.body,
    color: colors.textMuted,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  nameCell: { fontWeight: 600, color: colors.text, cursor: "pointer" },
  thumbnail: { width: 40, height: 40, borderRadius: 8, objectFit: "cover" },
  thumbnailPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.backgroundAlt,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 6,
    padding: "56px 24px",
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { ...typography.sectionTitle, color: colors.secondary, margin: 0 },
  emptyHint: { ...typography.body, color: colors.textMuted, margin: 0 },
};
