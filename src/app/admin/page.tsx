'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { apiRequest, pretty } from '@/lib/browserApi';

const sampleSchedule = {
  funds: [
    { fund_code: 'TECH', navValues: [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114] },
    { fund_code: 'PHARMA', navValues: [100, 99, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113] },
    { fund_code: 'ENERGY', navValues: [100, 100, 101, 101, 102, 102, 103, 103, 104, 104, 105, 105, 106, 106, 107] },
    { fund_code: 'BANKING', navValues: [100, 101, 100, 102, 101, 103, 102, 104, 103, 105, 104, 106, 105, 107, 106] },
    { fund_code: 'CONSUMER', navValues: [100, 100, 100, 101, 101, 102, 102, 103, 103, 104, 104, 105, 105, 106, 106] },
    { fund_code: 'AUTO', navValues: [100, 102, 101, 103, 102, 104, 103, 105, 104, 106, 105, 107, 106, 108, 107] },
    { fund_code: 'INFRA', navValues: [100, 99, 100, 101, 100, 102, 101, 103, 102, 104, 103, 105, 104, 106, 105] },
    { fund_code: 'METALS', navValues: [100, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111] },
    { fund_code: 'TELECOM', navValues: [100, 101, 101, 102, 102, 103, 103, 104, 104, 105, 105, 106, 106, 107, 107] },
    { fund_code: 'REALTY', navValues: [100, 99, 98, 100, 101, 99, 102, 103, 101, 104, 105, 103, 106, 107, 108] },
    { fund_code: 'FMCG', navValues: [100, 100, 101, 101, 102, 102, 103, 103, 104, 104, 105, 105, 106, 106, 107] },
  ],
};

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<unknown>(null);
  const [teams, setTeams] = useState<unknown>(null);
  const [p2p, setP2p] = useState<unknown>(null);
  const [audit, setAudit] = useState<unknown>(null);
  const [tradeId, setTradeId] = useState('');
  const [scheduleText, setScheduleText] = useState(pretty(sampleSchedule));

  useEffect(() => {
    setToken(localStorage.getItem('admin_token'));
  }, []);

  async function run(label: string, fn: () => Promise<void>) {
    setMessage(`${label}...`);
    try {
      await fn();
      setMessage(`${label} done`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `${label} failed`);
    }
  }

  async function refreshAll() {
    if (!token) return;
    await run('Refresh', async () => {
      const [nextState, nextTeams, nextP2p, nextAudit] = await Promise.all([
        apiRequest('/api/game/state'),
        apiRequest('/api/admin/teams', { token }),
        apiRequest('/api/admin/p2p/pending', { token }),
        apiRequest('/api/admin/audit', { token }),
      ]);
      setState(nextState);
      setTeams(nextTeams);
      setP2p(nextP2p);
      setAudit(nextAudit);
    });
  }

  async function post(path: string, label: string) {
    if (!token) return;
    await run(label, async () => {
      setState(await apiRequest(path, { method: 'POST', token }));
      await refreshAll();
    });
  }

  async function uploadSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    await run('Upload schedule', async () => {
      await apiRequest('/api/admin/schedule/upload', {
        method: 'POST',
        token,
        body: JSON.parse(scheduleText),
      });
    });
  }

  async function p2pAction(action: 'approve' | 'reject') {
    if (!token || !tradeId) return;
    await run(`${action} P2P`, async () => {
      await apiRequest(`/api/admin/p2p/${action}/${tradeId}`, { method: 'POST', token });
      await refreshAll();
    });
  }

  function logout() {
    localStorage.removeItem('admin_token');
    setToken(null);
  }

  if (!token) {
    return (
      <main>
        <section className="panel narrow">
          <h1>Admin Console</h1>
          <p>No admin token found.</p>
          <Link className="buttonLink" href="/admin/login">Go to admin login</Link>
        </section>
      </main>
    );
  }

  return (
    <main>
      <div className="topbar">
        <h1>Admin Console</h1>
        <div className="row">
          <button onClick={refreshAll}>Refresh all</button>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      {message ? <p className="notice">{message}</p> : null}

      <section className="grid">
        <div className="panel">
          <h2>Round Controls</h2>
          <div className="row wrap">
            <button onClick={() => post('/api/admin/round/advance', 'Advance')}>Advance</button>
            <button onClick={() => post('/api/admin/round/pause', 'Pause')}>Pause</button>
            <button onClick={() => post('/api/admin/round/resume', 'Resume')}>Resume</button>
          </div>
          <pre>{pretty(state)}</pre>
        </div>

        <div className="panel">
          <h2>P2P Approval</h2>
          <label>Trade ID<input value={tradeId} onChange={(e) => setTradeId(e.target.value)} /></label>
          <div className="row">
            <button onClick={() => p2pAction('approve')}>Approve</button>
            <button onClick={() => p2pAction('reject')}>Reject</button>
          </div>
        </div>

        <div className="panel wide">
          <h2>Upload Schedule</h2>
          <form className="stack" onSubmit={uploadSchedule}>
            <textarea value={scheduleText} onChange={(e) => setScheduleText(e.target.value)} />
            <button>Upload JSON</button>
          </form>
        </div>
      </section>

      <section className="grid dataGrid">
        <Data title="P2P Queue" data={p2p} />
        <Data title="Teams" data={teams} />
        <Data title="Audit" data={audit} />
      </section>
    </main>
  );
}

function Data({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <pre>{pretty(data)}</pre>
    </div>
  );
}
