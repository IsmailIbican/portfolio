export interface StoredFile {
  /** Public URL (or site path) the file is served from. */
  url: string;
}

export interface StoredObject extends StoredFile {
  uploadedAt: Date;
}

export interface Storage {
  put(key: string, data: Uint8Array, contentType: string): Promise<StoredFile>;
  /**
   * Deletes a file previously returned by put(). Unknown or external URLs are ignored.
   * Resolves to true when the URL was ours and a delete was issued, false when it was ignored.
   */
  remove(url: string): Promise<boolean>;
  /** Every file this app stored (keys that match the server-generated pattern), for the orphan sweep. */
  list(): Promise<StoredObject[]>;
}
