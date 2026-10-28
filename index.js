const fs = require('fs');
const dayjs = require("dayjs");
const dotenv = require("dotenv");
const { format: utilFormat } = require('util');
const format = "{tstamp} {tag} {txt}\n";
const path = require('path');
const sensitiveKey = /(authorization|token|secret|password|passwd|api[_-]?key|personal[_-]?access[_-]?token|\bpat\b|cookie)/i;
const maxStringLength = 2000;

async function error(...content) {
    await write(content, "black", "bgRed", "ERROR", true);
}

async function warn(...content) {
    await write(content, "black", "bgYellow", "WARN", true);
}

async function serveur(...content) {
    await write(content, "black", "bgBlue", "SERVER", false);
}

async function logs(...content) {
    await write(content, "black", "bgWhite", "LOG", false);
}

async function client(...content) {
    await write(content, "black", "bgGreen", "CLIENT", false);
}

function redactText(value) {
    const shortened = value.length > maxStringLength
        ? `${value.slice(0, maxStringLength)}…[truncated]`
        : value;
    return shortened
        .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
        .replace(/([?&]([^=&#\s]+)=)([^&#\s]*)/g, (match, prefix, key) => {
            let decodedKey = key;
            try {
                decodedKey = decodeURIComponent(key);
            } catch {
                decodedKey = key;
            }
            return sensitiveKey.test(decodedKey) ? `${prefix}[REDACTED]` : match;
        });
}

function safeValue(value, key = '', seen = new WeakSet()) {
    if (sensitiveKey.test(key)) return '[REDACTED]';
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return redactText(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'object') {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
        if (value instanceof Error) {
            return {
                name: value.name,
                message: safeValue(value.message, 'message', seen),
                stack: value.stack ? safeValue(value.stack, 'stack', seen) : undefined,
                cause: 'cause' in value ? safeValue(value.cause, 'cause', seen) : undefined,
            };
        }
        if (Array.isArray(value)) return value.map((item) => safeValue(item, '', seen));
        return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
            childKey,
            safeValue(childValue, childKey, seen),
        ]));
    }
    return String(value);
}

async function writeHttp(level, context, details, errorValue) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        context: safeValue(context),
        details: safeValue(details),
        ...(level === 'error' ? {
            error: errorValue instanceof Error
                ? safeValue(errorValue)
                : { message: safeValue(errorValue, 'error') },
        } : {}),
    };
    const tag = level === 'error' ? 'HTTP ERROR' : level === 'warn' ? 'HTTP WARN' : 'HTTP';
    const background = level === 'error' ? 'bgRed' : level === 'warn' ? 'bgYellow' : 'bgCyan';
    await write([JSON.stringify(entry)], 'black', background, tag, level !== 'info');
}

const http = Object.freeze({
    log(context, details = {}) {
        return writeHttp('info', context, details);
    },
    warn(context, details = {}) {
        return writeHttp('warn', context, details);
    },
    error(context, errorValue, details = {}) {
        return writeHttp('error', context, details, errorValue);
    },
});

function sql(table_name, content) {
    appendToFile(`${content}\n`, `${table_name}.sql`);
}

async function write(content, tagColor, bgTagColor, tag, error = false) {
    const chalk = (await import("chalk")).default;
    const timestamp = `[${dayjs().format("DD/MM - HH:mm:ss")}]`;
    const logTag = `[${tag}]`;
    const stream = error ? process.stderr : process.stdout;
    const message = utilFormat(...content);

    const item = format
        .replace("{tstamp}", chalk.gray(timestamp))
        .replace("{tag}", chalk[bgTagColor][tagColor](logTag))
        .replace("{txt}", chalk.white(message));
    appendToFile(item);
    stream.write(item);
}

module.exports = { error, warn, serveur, logs, client, http, sql };
function appendToFile(content, nameFile) {
    dotenv.config({debug: false, quiet: true});
    if (!process.env.DEBUG || process.env.DEBUG !== "true") return;
    if (!nameFile) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        nameFile = `logs-${yyyy}-${mm}-${dd}.txt`;
    }
    const filePath = `${process.env.LOGS ? process.env.LOGS : './logs'}/${nameFile}`;

    if (!content) {
        console.error('Le contenu est vide ou non défini.');
        return;
    }

    const strippedContent = content.replace(/\x1B\[[0-9;]*[mK]/g, '');

    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true, mode: 0o777 });
    }

    const fileExists = fs.existsSync(filePath);
    if (!fileExists) {
        fs.writeFileSync(filePath, '', { flag: 'wx' });
    }

    const lines = strippedContent.split('\n');
    fs.appendFileSync(filePath, lines.join('\n'));
}
