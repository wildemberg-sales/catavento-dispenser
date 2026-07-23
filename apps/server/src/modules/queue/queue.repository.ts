import { and, count, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { schema, type DbInstance } from "@catavento/db";
import { findSuggestionsForItem } from "../products/suggestion.js";

export type QueueItemRow = {
  id: string;
  batchId: string;
  externalRef: string;
  source: "mercado_livre" | "shopee" | "ebay";
  productId: string | null;
  payload: Record<string, unknown>;
  priority: number;
  status: "pending" | "in_progress" | "completed" | "cancelled" | "problem";
  createdAt: Date;
};

function mapQueueItemRow(row: Record<string, unknown>): QueueItemRow {
  return {
    id: row.id as string,
    batchId: row.batch_id as string,
    externalRef: row.external_ref as string,
    source: row.source as QueueItemRow["source"],
    productId: (row.product_id as string | null) ?? null,
    payload: row.payload as Record<string, unknown>,
    priority: Number(row.priority),
    status: row.status as QueueItemRow["status"],
    createdAt: new Date(row.created_at as string | Date),
  };
}

export function queueRepository(db: DbInstance) {
  return {
    // Dequeue atômico (Seção 5.1): SKIP LOCKED garante que dois operadores
    // concorrentes nunca peguem o mesmo item, sem bloqueio/espera. Não é
    // expressável no query builder fluente do Drizzle — SQL bruto dentro da
    // transação. Itens sem produto vinculado (product_id IS NULL) sempre vão
    // pro fim da fila — não dá pra montar sem foto/checklist — mas mantêm a
    // prioridade por loja e o FIFO entre si.
    async dequeueNext(operatorId: string): Promise<{ item: QueueItemRow; workLogId: string } | null> {
      return db.transaction(async (tx) => {
        const result = await tx.execute(sql`
          WITH next AS (
            SELECT id
            FROM queue_items
            WHERE status = 'pending'
            ORDER BY (product_id IS NULL) ASC, priority DESC, sequence ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          UPDATE queue_items q
          SET status = 'in_progress', updated_at = now()
          FROM next
          WHERE q.id = next.id
          RETURNING q.*
        `);

        const row = result.rows[0] as Record<string, unknown> | undefined;
        if (!row) {
          return null;
        }

        const item = mapQueueItemRow(row);
        const [workLog] = await tx
          .insert(schema.workLogs)
          .values({ queueItemId: item.id, operatorId, startedAt: new Date() })
          .returning({ id: schema.workLogs.id });

        return { item, workLogId: workLog!.id };
      });
    },

    async findCurrentForOperator(operatorId: string): Promise<QueueItemRow | null> {
      const [row] = await db
        .select({ item: schema.queueItems })
        .from(schema.workLogs)
        .innerJoin(schema.queueItems, eq(schema.workLogs.queueItemId, schema.queueItems.id))
        .where(and(eq(schema.workLogs.operatorId, operatorId), isNull(schema.workLogs.completedAt)));

      if (!row) {
        return null;
      }

      return {
        id: row.item.id,
        batchId: row.item.batchId,
        externalRef: row.item.externalRef,
        source: row.item.source,
        productId: row.item.productId,
        payload: row.item.payload as Record<string, unknown>,
        priority: row.item.priority,
        status: row.item.status,
        createdAt: row.item.createdAt,
      };
    },

    async findById(queueItemId: string) {
      const [row] = await db.select().from(schema.queueItems).where(eq(schema.queueItems.id, queueItemId));
      return row ?? null;
    },

    async findActiveWorkLog(queueItemId: string) {
      const [row] = await db
        .select()
        .from(schema.workLogs)
        .where(and(eq(schema.workLogs.queueItemId, queueItemId), isNull(schema.workLogs.completedAt)));
      return row ?? null;
    },

    // Seção 5.2: um item in_progress cujo work_log excede o timeout é
    // devolvido à fila. Roda periodicamente (ver abandonment.job.ts).
    async abandonStale(timeoutMinutes: number): Promise<number> {
      return db.transaction(async (tx) => {
        const staleLogs = await tx.execute(sql`
          UPDATE work_logs
          SET completed_at = now(), outcome = 'abandoned'
          WHERE completed_at IS NULL
            AND started_at < now() - make_interval(mins => ${timeoutMinutes})
          RETURNING queue_item_id
        `);

        const queueItemIds = staleLogs.rows.map((row) => (row as Record<string, unknown>).queue_item_id as string);
        if (queueItemIds.length === 0) {
          return 0;
        }

        await tx
          .update(schema.queueItems)
          .set({ status: "pending", updatedAt: new Date() })
          .where(inArray(schema.queueItems.id, queueItemIds));

        return queueItemIds.length;
      });
    },

    // Busca textual (Q) cobre tanto itens já vinculados a um produto do
    // catálogo (products.name é a fonte de verdade) quanto itens ainda sem
    // vínculo, cujo "nome" só existe dentro do payload bruto da importação —
    // e nem sempre com a mesma chave (a planilha de origem decide o header),
    // por isso o fallback tenta 'nome' e 'name' antes de cair pro externalRef.
    async adminListItems(
      filters: {
        status?: QueueItemRow["status"] | undefined;
        batchId?: string | undefined;
        source?: QueueItemRow["source"] | undefined;
        from?: string | undefined;
        to?: string | undefined;
        q?: string | undefined;
      },
      pagination: { page: number; pageSize: number }
    ) {
      const conditions = [];
      if (filters.status) conditions.push(eq(schema.queueItems.status, filters.status));
      if (filters.batchId) conditions.push(eq(schema.queueItems.batchId, filters.batchId));
      if (filters.source) conditions.push(eq(schema.queueItems.source, filters.source));
      if (filters.from) conditions.push(gte(schema.queueItems.createdAt, new Date(filters.from)));
      if (filters.to) conditions.push(lte(schema.queueItems.createdAt, new Date(filters.to)));
      if (filters.q) {
        const term = `%${filters.q}%`;
        conditions.push(sql`(
          ${schema.products.name} ILIKE ${term}
          OR ${schema.queueItems.payload}->>'nome' ILIKE ${term}
          OR ${schema.queueItems.payload}->>'name' ILIKE ${term}
          OR ${schema.queueItems.externalRef} ILIKE ${term}
        )`);
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      // O join com products já existe pra viabilizar o filtro `q` — aproveita
      // pra trazer os dados do produto vinculado junto (evita N+1 chamando
      // findLinkedProduct por linha; a lista já busca até 100 itens de uma vez).
      const columns = {
        id: schema.queueItems.id,
        batchId: schema.queueItems.batchId,
        externalRef: schema.queueItems.externalRef,
        source: schema.queueItems.source,
        productId: schema.queueItems.productId,
        payload: schema.queueItems.payload,
        priority: schema.queueItems.priority,
        status: schema.queueItems.status,
        createdAt: schema.queueItems.createdAt,
        productName: schema.products.name,
        productDescription: schema.products.description,
        productAttributes: schema.products.attributes,
        productAssemblyItems: schema.products.assemblyItems,
        productCreatedAt: schema.products.createdAt,
      };

      const offset = (pagination.page - 1) * pagination.pageSize;
      const [items, totalRows] = await Promise.all([
        db
          .select(columns)
          .from(schema.queueItems)
          .leftJoin(schema.products, eq(schema.queueItems.productId, schema.products.id))
          .where(where)
          .orderBy(desc(schema.queueItems.sequence))
          .limit(pagination.pageSize)
          .offset(offset),
        db
          .select({ total: count() })
          .from(schema.queueItems)
          .leftJoin(schema.products, eq(schema.queueItems.productId, schema.products.id))
          .where(where),
      ]);
      return { items, total: Number(totalRows[0]!.total) };
    },

    // Reconciliação global (cross-lote): mesma lógica de sugestão fuzzy do
    // findUnlinkedWithSuggestions por-lote em imports.repository.ts, sem o
    // filtro de batchId — pra alimentar uma tela única de "itens sem vínculo"
    // vindos de qualquer importação. Ordenado do mais recente pro mais antigo:
    // itens recém-chegados são os mais acionáveis (pedido ainda fresco); itens
    // antigos sem vínculo já apareceram em rodadas anteriores da tela.
    async findAllUnlinkedWithSuggestions(pagination: { page: number; pageSize: number }) {
      const offset = (pagination.page - 1) * pagination.pageSize;
      const where = sql`${schema.queueItems.productId} IS NULL`;
      const [rows, totalRows] = await Promise.all([
        db
          .select({
            id: schema.queueItems.id,
            externalRef: schema.queueItems.externalRef,
            source: schema.queueItems.source,
            payload: schema.queueItems.payload,
            batchId: schema.queueItems.batchId,
            createdAt: schema.queueItems.createdAt,
          })
          .from(schema.queueItems)
          .where(where)
          .orderBy(desc(schema.queueItems.sequence))
          .limit(pagination.pageSize)
          .offset(offset),
        db.select({ total: count() }).from(schema.queueItems).where(where),
      ]);

      const items = await Promise.all(
        rows.map(async (row) => ({
          id: row.id,
          externalRef: row.externalRef,
          source: row.source,
          payload: row.payload as Record<string, unknown>,
          batchId: row.batchId,
          createdAt: row.createdAt,
          suggestions: await findSuggestionsForItem(db, row.externalRef, row.payload as Record<string, unknown>),
        }))
      );

      return { items, total: Number(totalRows[0]!.total) };
    },

    async adminRequeue(queueItemId: string) {
      await db
        .update(schema.queueItems)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(schema.queueItems.id, queueItemId));
    },

    async adminCancel(queueItemId: string) {
      await db.transaction(async (tx) => {
        await tx
          .update(schema.workLogs)
          .set({ completedAt: new Date(), outcome: "cancelled" })
          .where(and(eq(schema.workLogs.queueItemId, queueItemId), isNull(schema.workLogs.completedAt)));

        await tx
          .update(schema.queueItems)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(schema.queueItems.id, queueItemId));
      });
    },

    async setProductId(queueItemId: string, productId: string) {
      await db
        .update(schema.queueItems)
        .set({ productId, updatedAt: new Date() })
        .where(eq(schema.queueItems.id, queueItemId));
    },

    async countPending(): Promise<number> {
      const [row] = await db
        .select({ total: count() })
        .from(schema.queueItems)
        .where(eq(schema.queueItems.status, "pending"));
      return Number(row!.total);
    },

    // Herança de dados (Seção 4.2): só dispara quando o item tem productId
    // (a maioria pode não estar vinculada, então evitar join sempre presente).
    // Produto soft-deletado depois do vínculo ainda é retornado — o trabalho
    // já foi vinculado, desativar o produto no catálogo não deve quebrar um
    // item já em andamento (só as sugestões de reconciliação filtram isActive).
    async findLinkedProduct(productId: string | null) {
      if (!productId) return null;
      const [product] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
      if (!product) return null;
      const images = await db
        .select()
        .from(schema.productImages)
        .where(eq(schema.productImages.productId, productId));
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        attributes: product.attributes,
        assemblyItems: product.assemblyItems,
        images: images.map((img) => ({ url: img.url, position: img.position })),
        createdAt: product.createdAt.toISOString(),
      };
    },

    async finishWorkLog(params: {
      workLogId: string;
      queueItemId: string;
      completedAt: Date;
      durationSeconds: number;
      outcome: "completed" | "problem";
      problemNote?: string;
      finalStatus: "completed" | "problem";
    }) {
      await db.transaction(async (tx) => {
        await tx
          .update(schema.workLogs)
          .set({
            completedAt: params.completedAt,
            durationSeconds: params.durationSeconds,
            outcome: params.outcome,
            problemNote: params.problemNote,
          })
          .where(eq(schema.workLogs.id, params.workLogId));

        await tx
          .update(schema.queueItems)
          .set({ status: params.finalStatus, updatedAt: new Date() })
          .where(eq(schema.queueItems.id, params.queueItemId));
      });
    },
  };
}

export type QueueRepository = ReturnType<typeof queueRepository>;
