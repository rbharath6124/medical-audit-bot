/// <reference types="vite/client" />

declare module "*?url" {
  const src: string;
  export default src;
}

declare module "*?worker" {
  const WorkerFactory: {
    new (options?: { name?: string }): Worker;
  };
  export default WorkerFactory;
}

interface Window {
  medAudit?: {
    selectStorageFolder: () => Promise<string | null>;
    readAudits: (folder: string) => Promise<unknown>;
    writeAudits: (folder: string, audits: unknown) => Promise<boolean>;
    clearAudits: (folder: string) => Promise<boolean>;
  };
}
