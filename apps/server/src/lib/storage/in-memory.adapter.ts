import type { StoragePort, StoredObjectMeta } from "./storage.port.js";

// Adapter usado nos testes (e por padrão em buildTestApp): tudo em memória,
// sem tocar o filesystem real. `_files` é exposto só para os testes
// inspecionarem o conteúdo quando necessário.
export function createInMemoryStorage(): StoragePort & { _files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();

  return {
    _files: files,

    async upload(params) {
      files.set(params.key, params.body);
      const meta: StoredObjectMeta = {
        key: params.key,
        url: `memory://${params.key}`,
        size: params.body.length,
        contentType: params.contentType,
      };
      return meta;
    },

    async delete(key) {
      files.delete(key);
    },

    async getUrl(key) {
      return `memory://${key}`;
    },
  };
}
