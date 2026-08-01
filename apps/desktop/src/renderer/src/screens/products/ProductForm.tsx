import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { CreateProductInput, ProductDTO, ProductSkuInput, UpdateProductInput } from "@catavento/contracts/products";
import type { SourceType } from "@catavento/contracts/queue";
import { useAuth } from "../../auth/AuthContext";
import { createProductsApi } from "../../api/products.api";
import { createAdminQueueApi } from "../../api/adminQueue.api";
import { ApiClientError } from "../../api/client";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

const SOURCES: SourceType[] = ["mercado_livre", "shopee", "ebay"];

type ProductFormLocationState = {
  prefillName?: string;
  prefillSku?: { source: SourceType; sku: string };
  fromQueueItemId?: string;
  imageUploadError?: string;
};

function emptySkuMap(): Record<SourceType, string> {
  return { mercado_livre: "", shopee: "", ebay: "" };
}

// "products/new" e "products/:productId/edit" renderizam o mesmo
// <ProductForm /> na mesma posição da árvore de rotas — sem uma key que
// varie com o que está sendo editado, o React reaproveita a mesma
// instância ao navegar de uma rota pra outra (ex.: editar o produto A e
// depois ir para "novo produto"), deixando nome/descrição/fotos do produto
// anterior visíveis no formulário "vazio". Usar essa rota como `element`
// (em vez de <ProductForm /> direto) força a remontagem sempre que o
// productId muda.
export function ProductFormRoute() {
  const { productId } = useParams<{ productId?: string }>();
  return <ProductForm key={productId ?? "new"} />;
}

export function ProductForm() {
  const { productId } = useParams<{ productId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { apiClient } = useAuth();
  const productsApi = useMemo(() => createProductsApi(apiClient), [apiClient]);
  const adminQueueApi = useMemo(() => createAdminQueueApi(apiClient), [apiClient]);

  const isEditing = Boolean(productId);
  const prefill = (location.state as ProductFormLocationState | null) ?? {};

  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [name, setName] = useState(prefill.prefillName ?? "");
  const [description, setDescription] = useState("");
  const [assemblyItems, setAssemblyItems] = useState<string[]>([]);
  const [newAssemblyItem, setNewAssemblyItem] = useState("");
  const [skus, setSkus] = useState<Record<SourceType, string>>(() => {
    const base = emptySkuMap();
    if (prefill.prefillSku) base[prefill.prefillSku.source] = prefill.prefillSku.sku;
    return base;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  // Fotos escolhidas antes do produto existir (modo de criação) — não há
  // como enviá-las pro storage sem um product_id (a tabela product_images
  // exige a FK), então ficam só na memória do formulário e sobem em lote
  // logo após o POST de criação ter sucesso.
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingImagePreviews, setPendingImagePreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = pendingImages.map((file) => URL.createObjectURL(file));
    setPendingImagePreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingImages]);

  // Não dá pra ler prefill.imageUploadError direto num useState inicial: as
  // rotas "products/new" e "products/:productId/edit" renderizam o mesmo
  // <ProductForm /> na mesma posição da árvore, então o React reaproveita a
  // mesma instância do componente ao navegar de uma pra outra (sem
  // desmontar) — o inicializador do useState só rodaria na primeira
  // montagem (modo de criação), nunca no momento em que essa mensagem
  // realmente chega. Um efeito reagindo a location.state cobre os dois
  // casos: navegação sem desmontar (este) e uma entrada direta na rota de
  // edição já com esse estado (mount novo).
  useEffect(() => {
    const state = location.state as ProductFormLocationState | null;
    if (state?.imageUploadError) setImageError(state.imageUploadError);
  }, [location.state]);

  useEffect(() => {
    if (!productId) return;
    productsApi.get(productId).then((loaded) => {
      setProduct(loaded);
      setName(loaded.name);
      setDescription(loaded.description ?? "");
      setAssemblyItems(loaded.assemblyItems ?? []);
      setSkus((current) => {
        const next = { ...current };
        for (const sku of loaded.skus ?? []) next[sku.source] = sku.sku;
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, productsApi]);

  function addAssemblyItem() {
    if (!newAssemblyItem.trim()) return;
    setAssemblyItems((items) => [...items, newAssemblyItem.trim()]);
    setNewAssemblyItem("");
  }

  function removeAssemblyItem(index: number) {
    setAssemblyItems((items) => items.filter((_, i) => i !== index));
  }

  function buildSkusInput(): ProductSkuInput[] {
    return SOURCES.filter((source) => skus[source].trim()).map((source) => ({
      source,
      sku: skus[source].trim(),
    }));
  }

  function buildInput(): CreateProductInput | UpdateProductInput {
    const input: { name: string; assemblyItems: string[]; skus: ProductSkuInput[]; description?: string } = {
      name,
      assemblyItems,
      skus: buildSkusInput(),
    };
    if (description.trim()) input.description = description.trim();
    return input;
  }

  async function handleUploadImages(files: FileList | null) {
    if (!files || !productId) return;
    setImageError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const image = await productsApi.uploadImage(productId, file);
        setProduct((current) => (current ? { ...current, images: [...current.images, image] } : current));
      }
    } catch (err) {
      setImageError(err instanceof ApiClientError ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!productId) return;
    await productsApi.deleteImage(productId, imageId);
    setProduct((current) =>
      current ? { ...current, images: current.images.filter((image) => image.id !== imageId) } : current
    );
  }

  function handleStageImages(files: FileList | null) {
    if (!files) return;
    setPendingImages((current) => [...current, ...Array.from(files)]);
  }

  function handleRemovePendingImage(index: number) {
    setPendingImages((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isEditing && productId) {
        const updated = await productsApi.update(productId, buildInput());
        setProduct(updated);
      } else {
        const created = await productsApi.create(buildInput() as CreateProductInput);
        if (prefill.fromQueueItemId) {
          await adminQueueApi.link(prefill.fromQueueItemId, { productId: created.id }).catch(() => {});
        }
        let failedUploads = 0;
        for (const file of pendingImages) {
          try {
            await productsApi.uploadImage(created.id, file);
          } catch (e) {
            console.log("DEBUG upload failed", e);
            failedUploads += 1;
          }
        }
        console.log("DEBUG failedUploads", failedUploads, "pendingImages.length", pendingImages.length);
        navigate(
          `/products/${created.id}/edit`,
          failedUploads > 0
            ? { state: { imageUploadError: `${failedUploads} de ${pendingImages.length} fotos não puderam ser enviadas.` } }
            : undefined
        );
        return;
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível salvar o produto.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.container}>
      <PageHeader
        title={isEditing ? "Editar produto" : "Novo produto"}
        subtitle="Nome, descrição, itens de montagem e SKUs por marketplace"
      />

      <Card style={styles.formCard}>
        <form style={styles.form} onSubmit={handleSubmit}>
          <label style={styles.label}>
            Nome
            <input
              data-testid="product-name"
              className="field"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label style={styles.label}>
            Descrição
            <textarea
              data-testid="product-description"
              className="field"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </label>

          <div style={styles.label}>
            Itens de montagem
            <div style={styles.assemblyList}>
              {assemblyItems.map((item, index) => (
                <span key={`${item}-${index}`} className="badge" style={styles.assemblyBadge}>
                  {item}
                  <button
                    type="button"
                    data-testid={`remove-assembly-item-${index}`}
                    onClick={() => removeAssemblyItem(index)}
                    style={styles.removeBadgeButton}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div style={styles.assemblyAddRow}>
              <input
                data-testid="assembly-item-input"
                className="field"
                type="text"
                placeholder="Ex.: Base de isopor"
                value={newAssemblyItem}
                onChange={(event) => setNewAssemblyItem(event.target.value)}
              />
              <Button type="button" variant="secondary" size="sm" data-testid="add-assembly-item" onClick={addAssemblyItem}>
                Adicionar
              </Button>
            </div>
          </div>

          <div style={styles.skusGrid}>
            {SOURCES.map((source) => (
              <label key={source} style={styles.label}>
                SKU — {source}
                <input
                  data-testid={`sku-${source}`}
                  className="field"
                  type="text"
                  value={skus[source]}
                  onChange={(event) => setSkus((current) => ({ ...current, [source]: event.target.value }))}
                />
              </label>
            ))}
          </div>

          {error ? <p style={styles.error}>{error}</p> : null}

          <Button data-testid="product-submit" type="submit" disabled={submitting} style={{ alignSelf: "flex-start" }}>
            {isEditing ? "Salvar alterações" : "Criar produto"}
          </Button>
        </form>
      </Card>

      {isEditing && product ? (
        <Card style={styles.galleryCard}>
          <h2 style={styles.sectionTitle}>🧁 Fotos do produto</h2>
          <div style={styles.galleryGrid}>
            {[...(product.images ?? [])]
              .sort((a, b) => a.position - b.position)
              .map((image) => (
                <div key={image.id} style={styles.imageTile}>
                  <img src={image.url} alt={image.url.split("/").pop() ?? ""} style={styles.imageThumb} />
                  <button
                    type="button"
                    data-testid={`delete-image-${image.id}`}
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDeleteImage(image.id)}
                  >
                    Excluir
                  </button>
                </div>
              ))}
          </div>
          <input
            data-testid="upload-image-input"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(event) => handleUploadImages(event.target.files)}
          />
          {imageError ? <p style={styles.error}>{imageError}</p> : null}
        </Card>
      ) : !isEditing ? (
        <Card style={styles.galleryCard}>
          <h2 style={styles.sectionTitle}>🧁 Fotos do produto</h2>
          <p style={styles.hint}>As fotos são enviadas assim que o produto for criado.</p>
          {pendingImages.length > 0 ? (
            <div style={styles.galleryGrid}>
              {pendingImages.map((file, index) => (
                <div key={index} style={styles.imageTile} data-testid={`pending-image-${index}`}>
                  <img src={pendingImagePreviews[index]} alt={file.name} style={styles.imageThumb} />
                  <button
                    type="button"
                    data-testid={`remove-pending-image-${index}`}
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleRemovePendingImage(index)}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <input
            data-testid="upload-image-input"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => handleStageImages(event.target.files)}
          />
        </Card>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 20 },
  formCard: { padding: 24, maxWidth: 640 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  label: { ...typography.label, color: colors.text, display: "flex", flexDirection: "column", gap: 6 },
  assemblyList: { display: "flex", flexWrap: "wrap", gap: 8 },
  assemblyBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: colors.secondary,
    backgroundColor: colors.secondarySoft,
  },
  removeBadgeButton: {
    border: "none",
    background: "none",
    cursor: "pointer",
    color: colors.secondary,
    fontWeight: 700,
    padding: 0,
    lineHeight: 1,
  },
  assemblyAddRow: { display: "flex", gap: 8, alignItems: "center" },
  skusGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 },
  error: { ...typography.label, color: colors.danger, margin: 0 },
  galleryCard: { padding: 24, maxWidth: 640, display: "flex", flexDirection: "column", gap: 14 },
  sectionTitle: { ...typography.sectionTitle, color: colors.secondary, margin: 0 },
  hint: { ...typography.small, color: colors.textMuted, margin: 0 },
  galleryGrid: { display: "flex", flexWrap: "wrap", gap: 16 },
  imageTile: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 96 },
  imageThumb: { width: 96, height: 96, borderRadius: 10, objectFit: "cover" },
};
