export interface ClientOptions {
  readonly host: string;
  readonly port: number;
  readonly path?: string;
  readonly basic_auth?: { readonly user: string; readonly pass: string };
}

export interface Client {
  methodCall(
    method: string,
    params: readonly unknown[],
    callback: (error: unknown, value?: unknown) => void,
  ): void;
}

export type ServerCallback = (error: unknown, value: unknown) => void;
export interface Server {
  on(
    method: string,
    listener: (error: unknown, params: unknown[], callback: ServerCallback) => void,
  ): unknown;
  close(callback: () => void): void;
}

export function createClient(options: ClientOptions): Client;
export function createServer(
  options: { readonly host: string; readonly port: number },
  callback?: () => void,
): Server;
