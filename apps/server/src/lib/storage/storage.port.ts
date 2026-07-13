export type StoredObjectMeta = {
  key: string;
  url: string;
  size: number;
  contentType: string;
};

export interface StoragePort {
  upload(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObjectMeta>;

  delete(key: string): Promise<void>;

  getUrl(key: string): Promise<string>;
}
