export interface ApiHarnessOptions {
  port?: number;
  host?: string;
}

export interface ApiHarnessInstance {
  start(): Promise<{ url: string; port: number }>;
  stop(): Promise<void>;
}
