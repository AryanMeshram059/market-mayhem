'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { apiRequest, pretty } from '@/lib/browserApi';

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<unknown>(null);
  const [funds, setFunds] = useState<unknown>(null);
  const [portfolio, setPortfolio] = useState<unknown>(null);
  const [pending, setPending] = useState<unknown>(null);
  const [history, setHistory] = useState<unknown>(null);
  const [news, setNews] = useState<unknown>(null);
  const [leaderboard, setLeaderboard] = useState<unknown>(null);
  const [orderId, setOrderId] = useState('');
  const [tradeId, setTradeId] = useState('');
  const [tradeStatus, setTradeStatus] = useState<unknown>(null);

  useEffect(() => {
    setToken(localStorage.getItem('team_token'));
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
      const [nextState, nextFunds, nextPortfolio, nextPending, nextHistory, nextNews, nextLeaderboard] =
        await Promise.all([
          apiRequest('/api/game/state'),
          apiRequest('/api/funds'),
          apiRequest('/api/portfolio', { token }),
          apiRequest('/api/order/pending', { token }),
          apiRequest('/api/portfolio/history', { token }),
          apiRequest('/api/game/news'),
          apiRequest('/api/game/leaderboard'),
        ]);
      setState(nextState);
      setFunds(nextFunds);
      setPortfolio(nextPortfolio);
      setPending(nextPending);
      setHistory(nextHistory);
      setNews(nextNews);
      setLeaderboard(nextLeaderboard);
    });
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    await run('Submit order', async () => {
      const result = await apiRequest<{ order_id: string }>('/api/order/submit', {
        method: 'POST',
        token,
        body: {
          fund_id: Number(form.get('fund_id')),
          type: form.get('type'),
          quantity: Number(form.get('quantity')),
        },
      });
      setOrderId(result.order_id);
      await refreshAll();
    });
  }

  async function modifyOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !orderId) return;
    const form = new FormData(event.currentTarget);
    await run('Modify order', async () => {
      await apiRequest(`/api/order/modify/${orderId}`, {
        method: 'PATCH',
        token,
        body: { quantity: Number(form.get('quantity')) },
      });
      await refreshAll();
    });
  }

  async function cancelOrder() {
    if (!token || !orderId) return;
    await run('Cancel order', async () => {
      await apiRequest(`/api/order/cancel/${orderId}`, { method: 'DELETE', token });
      setOrderId('');
      await refreshAll();
    });
  }

  async function proposeP2P(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    await run('Propose P2P', async () => {
      const result = await apiRequest<{ trade_id: string }>('/api/p2p/propose', {
        method: 'POST',
        token,
        body: {
          counterparty_team_id: Number(form.get('counterparty_team_id')),
          fund_id: Number(form.get('fund_id')),
          quantity: Number(form.get('quantity')),
          price_per_unit: Number(form.get('price_per_unit')),
          direction: form.get('direction'),
        },
      });
      setTradeId(result.trade_id);
    });
  }

  async function checkTrade() {
    if (!token || !tradeId) return;
    await run('Check P2P', async () => {
      setTradeStatus(await apiRequest(`/api/p2p/status/${tradeId}`, { token }));
    });
  }

  function logout() {
    localStorage.removeItem('team_token');
    localStorage.removeItem('team_name');
    setToken(null);
  }

  if (!token) {
    return (
      <main>
        <section className="panel narrow">
          <h1>Team Dashboard</h1>
          <p>No team token found.</p>
          <Link className="buttonLink" href="/login">Go to team login</Link>
        </section>
      </main>
    );
  }

  return (
    <main>
      <div className="topbar">
        <h1>Team Dashboard</h1>
        <div className="row">
          <button onClick={refreshAll}>Refresh all</button>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      {message ? <p className="notice">{message}</p> : null}

      <section className="grid">
        <div className="panel">
          <h2>Submit Order</h2>
          <form className="stack compact" onSubmit={submitOrder}>
            <label>Fund ID<input name="fund_id" type="number" defaultValue="1" /></label>
            <label>Type<select name="type" defaultValue="buy"><option value="buy">buy</option><option value="sell">sell</option></select></label>
            <label>Quantity<input name="quantity" type="number" step="0.0001" defaultValue="100" /></label>
            <button>Submit</button>
          </form>
        </div>

        <div className="panel">
          <h2>Pending Order Tools</h2>
          <label>Order ID<input value={orderId} onChange={(e) => setOrderId(e.target.value)} /></label>
          <form className="stack compact" onSubmit={modifyOrder}>
            <label>New quantity<input name="quantity" type="number" step="0.0001" defaultValue="50" /></label>
            <button>Modify</button>
          </form>
          <button onClick={cancelOrder}>Cancel selected order</button>
        </div>

        <div className="panel">
          <h2>Propose P2P</h2>
          <form className="stack compact" onSubmit={proposeP2P}>
            <label>Counterparty team ID<input name="counterparty_team_id" type="number" defaultValue="2" /></label>
            <label>Fund ID<input name="fund_id" type="number" defaultValue="1" /></label>
            <label>Quantity<input name="quantity" type="number" step="0.0001" defaultValue="10" /></label>
            <label>Price per unit<input name="price_per_unit" type="number" step="0.0001" defaultValue="100" /></label>
            <label>Direction<select name="direction" defaultValue="sell"><option value="sell">sell</option><option value="buy">buy</option></select></label>
            <button>Propose</button>
          </form>
        </div>

        <div className="panel">
          <h2>P2P Status</h2>
          <label>Trade ID<input value={tradeId} onChange={(e) => setTradeId(e.target.value)} /></label>
          <button onClick={checkTrade}>Check status</button>
          <pre>{pretty(tradeStatus)}</pre>
        </div>
      </section>

      <section className="grid dataGrid">
        <Data title="Game State" data={state} />
        <Data title="Portfolio" data={portfolio} />
        <Data title="Pending Orders" data={pending} />
        <Data title="Order History" data={history} />
        <Data title="Funds" data={funds} />
        <Data title="News" data={news} />
        <Data title="Leaderboard" data={leaderboard} />
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
