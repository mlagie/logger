/**
 * Log an error with a red tag and write it to a file when DEBUG=true.
 * @param content - Values to log.
 * @returns Promise<void>
 */
export declare function error(...content: unknown[]): Promise<void>;

/**
 * Log a warning with a yellow tag on stderr and write it to a file when DEBUG=true.
 * @param content - Values to log.
 * @returns Promise<void>
 */
export declare function warn(...content: unknown[]): Promise<void>;

/**
 * Log a server message with a blue tag and write it to a file when DEBUG=true.
 * @param content - Values to log.
 * @returns Promise<void>
 */
export declare function serveur(...content: unknown[]): Promise<void>;

/**
 * Log a general message with a white tag and write it to a file when DEBUG=true.
 * @param content - Values to log.
 * @returns Promise<void>
 */
export declare function logs(...content: unknown[]): Promise<void>;

/**
 * Log a client message with a green tag and write it to a file when DEBUG=true.
 * @param content - Values to log.
 * @returns Promise<void>
 */
export declare function client(...content: unknown[]): Promise<void>;

/** HTTP request or response details. Sensitive fields are redacted. */
export interface HttpLogDetails {
  requestId?: string;
  method?: string;
  url?: string;
  route?: string;
  status?: number;
  durationMs?: number;
  ip?: string;
  [key: string]: unknown;
}

/** Write a structured HTTP event as a single JSON line. */
export declare const http: {
  log(context: string, details?: HttpLogDetails): Promise<void>;
  warn(context: string, details?: HttpLogDetails): Promise<void>;
  error(context: string, error: unknown, details?: HttpLogDetails): Promise<void>;
};

/**
 * Append a line to a table-specific SQL file.
 * @param table_name - The table or SQL file name.
 * @param content - Text to append.
 */
export declare function sql(table_name: string, content: string): void;
