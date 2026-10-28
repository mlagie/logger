const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const logger = require('../index.js');

async function captureLogs(operation) {
    const originalStdoutWrite = process.stdout.write;
    const originalStderrWrite = process.stderr.write;
    let stdout = '';
    let stderr = '';
    process.stdout.write = function (chunk, encoding, callback) {
        stdout += String(chunk);
        if (typeof encoding === 'function') encoding();
        else if (typeof callback === 'function') callback();
        return true;
    };
    process.stderr.write = function (chunk, encoding, callback) {
        stderr += String(chunk);
        if (typeof encoding === 'function') encoding();
        else if (typeof callback === 'function') callback();
        return true;
    };
    try {
        await operation();
    } finally {
        process.stdout.write = originalStdoutWrite;
        process.stderr.write = originalStderrWrite;
    }
    return { stdout, stderr };
}

function httpEntries(output) {
    return output.trim().split('\n').filter(Boolean).map((line) => {
        const jsonStart = line.indexOf('{"timestamp"');
        assert.notEqual(jsonStart, -1, line);
        return JSON.parse(line.slice(jsonStart));
    });
}

test('warn écrit sur stderr et conserve les méthodes existantes', async () => {
    const result = await captureLogs(async () => {
        await logger.warn('Attention %s', 'réseau');
        await logger.logs('Message %s', 'courant');
        await logger.serveur('Serveur démarré');
        await logger.client('Client connecté');
        await logger.error('Erreur connue');
    });
    assert.match(result.stderr, /\[WARN\] Attention réseau/);
    assert.match(result.stderr, /\[ERROR\] Erreur connue/);
    assert.match(result.stdout, /\[LOG\] Message courant/);
    assert.match(result.stdout, /\[SERVER\] Serveur démarré/);
    assert.match(result.stdout, /\[CLIENT\] Client connecté/);
});

test('http.log, http.warn et http.error écrivent des événements structurés', async () => {
    const result = await captureLogs(async () => {
        await logger.http.log('Requête terminée', { requestId: 'req-1', method: 'GET', status: 200 });
        await logger.http.warn('Requête refusée', { requestId: 'req-2', method: 'POST', status: 403 });
        await logger.http.error('Réponse en erreur', new Error('HTTP 502'), { requestId: 'req-3', status: 502 });
    });
    const [info] = httpEntries(result.stdout);
    const [warning, failure] = httpEntries(result.stderr);
    assert.match(result.stdout, /\[HTTP\]/);
    assert.match(result.stderr, /\[HTTP WARN\]/);
    assert.match(result.stderr, /\[HTTP ERROR\]/);
    assert.match(info.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(info, {
        timestamp: info.timestamp,
        level: 'info',
        context: 'Requête terminée',
        details: { requestId: 'req-1', method: 'GET', status: 200 },
    });
    assert.equal(warning.level, 'warn');
    assert.equal(warning.details.requestId, 'req-2');
    assert.equal(failure.level, 'error');
    assert.equal(failure.error.name, 'Error');
    assert.equal(failure.error.message, 'HTTP 502');
    assert.match(failure.error.stack, /HTTP 502/);
});

test('les événements HTTP masquent les secrets imbriqués et les URL', async () => {
    const cycle = {};
    cycle.self = cycle;
    const result = await captureLogs(() => logger.http.error(
        'Échec /api?token=context-secret',
        new Error('Bearer error-secret', { cause: new Error('/api?api_key=cause-secret') }),
        {
            requestId: 'req-4',
            authorization: 'Bearer header-secret',
            url: '/api?token=url-secret&ok=1',
            headers: { cookie: 'session=cookie-secret' },
            nested: { password: 'password-secret', apiKey: 'key-secret' },
            cycle,
        },
    ));
    for (const secret of [
        'context-secret', 'error-secret', 'cause-secret', 'header-secret',
        'url-secret', 'cookie-secret', 'password-secret', 'key-secret',
    ]) {
        assert.equal(result.stderr.includes(secret), false, secret);
    }
    const [entry] = httpEntries(result.stderr);
    assert.equal(entry.details.authorization, '[REDACTED]');
    assert.equal(entry.details.headers.cookie, '[REDACTED]');
    assert.equal(entry.details.nested.password, '[REDACTED]');
    assert.equal(entry.details.url, '/api?token=[REDACTED]&ok=1');
    assert.equal(entry.details.cycle.self, '[Circular]');
    assert.match(entry.error.message, /Bearer \[REDACTED\]/);
});

test('DEBUG=true écrit aussi les événements HTTP dans le fichier journal', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mlagie-logger-test-'));
    const originalDebug = process.env.DEBUG;
    const originalLogs = process.env.LOGS;
    try {
        process.env.DEBUG = 'true';
        process.env.LOGS = directory;
        await captureLogs(() => logger.http.warn('Requête refusée', { requestId: 'req-file', status: 403 }));
        const files = fs.readdirSync(directory);
        assert.equal(files.length, 1);
        const content = fs.readFileSync(path.join(directory, files[0]), 'utf8');
        assert.match(content, /\[HTTP WARN\]/);
        assert.equal(httpEntries(content)[0].details.requestId, 'req-file');
    } finally {
        if (originalDebug === undefined) delete process.env.DEBUG;
        else process.env.DEBUG = originalDebug;
        if (originalLogs === undefined) delete process.env.LOGS;
        else process.env.LOGS = originalLogs;
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
