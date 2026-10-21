// VOXCONPACK Audit Logger & Provenance Store
// Records the complete command trace from human voice to normalized intent, authority check, execution, and COMMPACK output.
import { VoxAuditRecord } from './types';

const STORAGE_KEY = 'voxcon_audit_logs';
const MAX_LOGS = 100;

class AuditLogger {
  private logs: VoxAuditRecord[] = [];
  private listeners: Set<(logs: VoxAuditRecord[]) => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch {
      this.logs = [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs.slice(0, MAX_LOGS)));
    } catch {
      // Storage quota exceeded or disabled
    }
    this.notify();
  }

  public record(entry: Omit<VoxAuditRecord, 'id'>): VoxAuditRecord {
    const record: VoxAuditRecord = {
      id: `LOG-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      ...entry,
    };

    this.logs.unshift(record);
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS);
    }

    this.persist();

    // Optionally forward to backend audit endpoint if available
    try {
      fetch('/api/voxcon/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      }).catch(() => {
        // Backend optional in local offline mode
      });
    } catch {
      // Ignore network errors in local environment
    }

    return record;
  }

  public getLogs(): VoxAuditRecord[] {
    return [...this.logs];
  }

  public clear(): void {
    this.logs = [];
    this.persist();
  }

  public subscribe(listener: (logs: VoxAuditRecord[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.logs);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const current = [...this.logs];
    for (const listener of this.listeners) {
      listener(current);
    }
  }
}

export const auditLogger = new AuditLogger();
