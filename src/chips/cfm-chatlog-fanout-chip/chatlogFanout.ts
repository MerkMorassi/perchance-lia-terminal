import type { AutomationConfig } from '../types.ts';

export interface ChatlogTurn {
    agentId: string;
    user: string;
    model: string;
}

interface ChatlogEntry extends ChatlogTurn {
    type: 'chatlog.turn';
    projectId: string;
    at: number;
}

const PROJECTS_KEY = 'mythos_projects_v2';
const BROWSER_KEY = 'mythos_chatlog_v1';
const BROWSER_CAP = 500;
const POST_TIMEOUT_MS = 8000;

function loadConfig(): { projectId: string; cfg: AutomationConfig } | null {
    try {
        const raw = localStorage.getItem(PROJECTS_KEY);
        if (!raw) return null;
        const projects = JSON.parse(raw);
        const p = Array.isArray(projects) ? projects[0] : null;
        if (!p || !p.data || !p.data.automationConfig) return null;
        return { projectId: String(p.id || ''), cfg: p.data.automationConfig as AutomationConfig };
    } catch {
        return null;
    }
}

async function post(url: string, body: unknown): Promise<boolean> {
    try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), POST_TIMEOUT_MS);
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: ctl.signal,
        });
        clearTimeout(t);
        return res.ok;
    } catch {
        return false;
    }
}

function studioIngestUrl(raw: string): string {
    const u = (raw || '').trim();
    if (!u) return '';
    return u.replace(/\/api\/rag\/?$/, '/api/chatlog');
}

export function fanoutChatTurn(turn: ChatlogTurn): void {
    let found: { projectId: string; cfg: AutomationConfig } | null = null;
    try {
        found = loadConfig();
    } catch {
        return;
    }
    if (!found) return;
    const { projectId, cfg } = found;
    if (!cfg.ragEnabled) return;

    const entry: ChatlogEntry = {
        type: 'chatlog.turn',
        projectId,
        agentId: turn.agentId,
        user: turn.user || '',
        model: turn.model || '',
        at: Date.now(),
    };

    try {
        const raw = localStorage.getItem(BROWSER_KEY);
        const arr: ChatlogEntry[] = raw ? JSON.parse(raw) : [];
        arr.push(entry);
        while (arr.length > BROWSER_CAP) arr.shift();
        localStorage.setItem(BROWSER_KEY, JSON.stringify(arr));
    } catch {
        // browser lane full or blocked: remote lanes still fire below
    }

    const jobs: Array<Promise<boolean>> = [];

    const sUrl = studioIngestUrl(cfg.ragLocalhostUrl || '');
    if (sUrl) jobs.push(post(sUrl, entry));

    const cUrl = (cfg.ragBaseUrl || '').trim();
    if (cUrl && (cfg.ragApiKey || '').trim() && (cfg.ragKnowledgeBoxId || '').trim()) {
        jobs.push(post(cUrl, { apiKey: cfg.ragApiKey, boxId: cfg.ragKnowledgeBoxId, entry }));
    }

    for (const u of cfg.webhookUrls || []) {
        const url = (u || '').trim();
        if (url.startsWith('http')) jobs.push(post(url, entry));
    }

    if (jobs.length) {
        Promise.allSettled(jobs).then((rs) => {
            const ok = rs.filter((r) => r.status === 'fulfilled' && r.value).length;
            console.debug(`[CHATLOG] fanned out to ${ok}/${jobs.length} remote targets.`);
        });
    }
}

export async function testWebhook(url: string): Promise<boolean> {
    const u = (url || '').trim();
    if (!u.startsWith('http')) return false;
    return post(u, { type: 'webhook.test', at: Date.now() });
}
