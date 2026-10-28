# @mlagie/logger

Display color-coded log messages in the console and optionally write them to files.

## Install

```bash
npm install @mlagie/logger
```

## Dependencies

- chalk
- dayjs
- dotenv

## Configuration

Set these variables in your application's environment or `.env` file:

```
DEBUG=true
LOGS=./logs
```
- `DEBUG=true` enables file logging.
- `LOGS` sets the directory for log files. It defaults to `./logs`.

## Usage

```js
const { error, warn, serveur, logs, client, sql } = require('@mlagie/logger');

async function example() {
  await error('A serious error occurred');
  await warn('An operation needs attention');
  await serveur('Server started');
  await logs('General message');
  await client('Client connected');
  await logs('Account %s connected', 'example');
  sql('users', 'SELECT * FROM users;');
}

example().catch(console.error);
```

## API

### error(...content: unknown[]): Promise<void>

Log an error with a red tag on `stderr`. Arguments are formatted like `console.log`. File logging requires `DEBUG=true`.

### warn(...content: unknown[]): Promise<void>

Log a warning with a yellow tag on `stderr`. Arguments are formatted like `console.log`. File logging requires `DEBUG=true`.

### serveur(...content: unknown[]): Promise<void>

Log a server message with a blue tag on `stdout`. Arguments are formatted like `console.log`. File logging requires `DEBUG=true`.

### logs(...content: unknown[]): Promise<void>

Log a general message with a white tag on `stdout`. Arguments are formatted like `console.log`. File logging requires `DEBUG=true`.

### client(...content: unknown[]): Promise<void>

Log a client message with a green tag on `stdout`. Arguments are formatted like `console.log`. File logging requires `DEBUG=true`.

### http.log(context, details), http.warn(context, details), http.error(context, error, details)

Emit one line with the usual timestamp and tag prefix followed by a JSON event containing `timestamp`, `level`, `context`, and `details`. `http.error` also includes the error name, message, stack, and cause when available. `http.log` writes to `stdout`; `http.warn` and `http.error` write to `stderr`. File logging requires `DEBUG=true`.

Values under sensitive keys such as `authorization`, `token`, `secret`, `password`, `api_key`, and `cookie` are redacted, including in nested objects. Bearer tokens and sensitive URL query parameters are also redacted. Do not pass raw request bodies or unstructured secrets in `context`.

For a Fastify instance named `app`:

```js
const { http } = require('@mlagie/logger');

app.addHook('onResponse', async (request, reply) => {
  const details = {
    requestId: request.id,
    method: request.method,
    route: request.routeOptions.url,
    status: reply.statusCode,
    durationMs: reply.elapsedTime,
  };
  if (reply.statusCode >= 500) {
    await http.error('HTTP response failed', new Error(`HTTP ${reply.statusCode}`), details);
  } else if (reply.statusCode >= 400) {
    await http.warn('HTTP request rejected', details);
  } else {
    await http.log('HTTP request completed', details);
  }
});
```

### sql(table_name: string, content: string): void

Append a line to a table-specific SQL file.

## License

MIT
