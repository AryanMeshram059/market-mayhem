'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client';
import { Button } from '@/components/ui/button';

interface AuditEntry {
  event_id: number;
  timestamp: string;
  event_type: string;
  team_id?: number;
  admin_id?: string;
  details: Record<string, unknown>;
}

export function AuditViewer() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [eventType, setEventType] = useState('');
  const [page, setPage] = useState(1);

  const fetchAudit = async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (eventType) params.set('event_type', eventType);
      const data = await apiFetch<{ entries: AuditEntry[] }>(
        `/api/admin/audit?${params}`, {}, true
      );
      if (data) setEntries(data.entries);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchAudit(); }, [page, eventType]);

  const exportCsv = () => {
    const header = 'timestamp,event_type,team_id,admin_id\n';
    const rows = entries.map((e) =>
      `${e.timestamp},${e.event_type},${e.team_id ?? ''},${e.admin_id ?? ''}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit_log.csv';
    a.click();
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Audit Log</h3>
        <Button size="sm" variant="outline" onClick={exportCsv}>Export CSV</Button>
      </div>
      <input type="text" placeholder="Filter by event type" value={eventType}
        onChange={(e) => setEventType(e.target.value)}
        className="w-full rounded-md border px-3 py-2 text-sm" />
      <div className="max-h-96 overflow-y-auto space-y-1 text-xs font-mono">
        {entries.map((entry) => (
          <div key={entry.event_id} className="border-b py-1">
            <span className="text-muted-foreground">{entry.timestamp}</span>{' '}
            <span className="font-semibold">{entry.event_type}</span>
            {entry.team_id && <span> team={entry.team_id}</span>}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}>Previous</Button>
        <Button size="sm" variant="outline" onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </div>
  );
}
