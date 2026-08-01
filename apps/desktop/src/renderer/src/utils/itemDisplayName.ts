// Fallback de nome pra itens de fila sem produto vinculado — a chave do
// payload cru varia conforme o header da planilha de origem ('nome' ou
// 'name'). productName é usado quando o item já resolve um nome de produto
// no próprio backend (ex.: ProblemQueueItem); itens sem essa resolução
// (ex.: UnlinkedItem) simplesmente não têm o campo.
//
// Antes essa lógica estava duplicada em três telas — e uma das cópias
// (o título do card em ImportDetailScreen) só checava payload.nome, pulando
// silenciosamente o caso payload.name que as outras duas cópias tratavam
// corretamente.
export function itemDisplayName(item: {
  productName?: string | null;
  payload: Record<string, unknown>;
  externalRef: string;
}): string {
  return (
    item.productName ??
    (item.payload.nome as string | undefined) ??
    (item.payload.name as string | undefined) ??
    item.externalRef
  );
}
