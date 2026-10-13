import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Where photos and documents are kept: on the local disk in development and
 * tests, in Supabase Storage (a private bucket) in production. Files are only
 * reached through /fichiers, which checks who may see them.
 */

export type StoredFile = { data: Buffer; contentType: string };

export interface FileStore {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  remove(key: string): Promise<void>;
}

/** Keys are relative paths of letters, digits, dashes, dots and slashes. */
export function isSafeKey(key: string): boolean {
  return (
    /^[a-z0-9][a-z0-9/_.-]{0,200}$/i.test(key) &&
    !key.split("/").some((part) => part === "" || part === "." || part === "..")
  );
}

function check(key: string) {
  if (!isSafeKey(key)) throw new Error(`unsafe storage key: ${key}`);
}

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

export function contentTypeOf(key: string) {
  return (
    TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ??
    "application/octet-stream"
  );
}

function localStore(root: string): FileStore {
  const file = (key: string) => {
    check(key);
    return path.join(/* turbopackIgnore: true */ root, key);
  };
  return {
    async put(key, data) {
      const target = file(key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, data);
    },
    async get(key) {
      try {
        return {
          data: await readFile(file(key)),
          contentType: contentTypeOf(key),
        };
      } catch {
        return null;
      }
    },
    async remove(key) {
      await rm(file(key), { force: true });
    },
  };
}

function supabaseStore(
  url: string,
  serviceKey: string,
  bucket: string,
): FileStore {
  const object = (key: string) => {
    check(key);
    return `${url.replace(/\/$/, "")}/storage/v1/object/${bucket}/${key}`;
  };
  const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
  return {
    async put(key, data, contentType) {
      const response = await fetch(object(key), {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": contentType,
          "x-upsert": "true",
        },
        body: new Uint8Array(data),
      });
      if (!response.ok) throw new Error(`storage put ${response.status}`);
    },
    async get(key) {
      const response = await fetch(object(key), { headers, cache: "no-store" });
      if (!response.ok) return null;
      return {
        data: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get("content-type") ?? contentTypeOf(key),
      };
    },
    async remove(key) {
      await fetch(object(key), { method: "DELETE", headers });
    },
  };
}

let store: FileStore | null = null;

export function fileStore(): FileStore {
  if (store) return store;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET } =
    process.env;
  store =
    SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
      ? supabaseStore(
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
          SUPABASE_BUCKET || "fichiers",
        )
      : localStore(
          path.resolve(
            /* turbopackIgnore: true */ process.env.STORAGE_DIR ||
              ".data/fichiers",
          ),
        );
  return store;
}
