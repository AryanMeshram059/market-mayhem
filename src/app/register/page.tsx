'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/browserApi';

type MemberForm = {
  name: string;
  email: string;
  roll_number: string;
};

const emptyPlayer = (): MemberForm => ({
  name: '',
  email: '',
  roll_number: '',
});

export default function RegisterPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [password, setPassword] = useState('');
  const [captain, setCaptain] = useState<MemberForm>(emptyPlayer());
  const [players, setPlayers] = useState<MemberForm[]>([emptyPlayer(), emptyPlayer(), emptyPlayer(), emptyPlayer()]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updatePlayer(index: number, field: keyof MemberForm, value: string) {
    setPlayers((current) => current.map((player, playerIndex) => (playerIndex === index ? { ...player, [field]: value } : player)));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await apiRequest<{ team_id: number; team_code: string; team_name: string }>('/api/auth/register', {
        method: 'POST',
        body: {
          team_name: teamName,
          password,
          captain,
          players,
        },
      });
      setMessage(`Registered ${result.team_name}. Your team code is ${result.team_code}.`);
      setTimeout(() => {
        router.push('/login');
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="dark min-h-screen bg-background px-6 py-10 text-foreground md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to home
        </Link>

        <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">

          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <Badge variant="outline" className="w-fit border-primary/35 bg-primary/10 px-3 py-1 font-mono tracking-[0.2em] text-primary">
                REGISTRATION
              </Badge>
              <CardTitle className="text-3xl text-white">Create a team</CardTitle>
              <CardTitle className="text-white">Registration form</CardTitle>
              <CardDescription>Add a captain and any optional players. The team will be remembered in the database.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-6">
                <section className="grid gap-4 md:grid-cols-2">
                  <Field label="Team name">
                    <Input value={teamName} onChange={(event) => setTeamName(event.target.value)} required />
                  </Field>
                  <Field label="Team password">
                    <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                  </Field>
                </section>

                <section className="space-y-4">
                  <SectionTitle icon={<Users className="size-4 text-primary" />} title="Captain" />
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Captain name">
                      <Input value={captain.name} onChange={(event) => setCaptain({ ...captain, name: event.target.value })} required />
                    </Field>
                    <Field label="Captain email">
                      <Input type="email" value={captain.email} onChange={(event) => setCaptain({ ...captain, email: event.target.value })} required />
                    </Field>
                    <Field label="Captain roll number">
                      <Input value={captain.roll_number} onChange={(event) => setCaptain({ ...captain, roll_number: event.target.value })} required />
                    </Field>
                  </div>
                </section>

                <section className="space-y-4">
                  <SectionTitle icon={<Users className="size-4 text-primary" />} title="Optional players 2-5" />
                  <div className="space-y-4">
                    {players.map((player, index) => (
                      <div key={index} className="rounded-xl border border-border/70 bg-background/45 p-4">
                        <p className="mb-3 font-medium text-white">Player {index + 2} optional</p>
                        <div className="grid gap-4 md:grid-cols-3">
                          <Field label="Name">
                            <Input value={player.name} onChange={(event) => updatePlayer(index, 'name', event.target.value)} />
                          </Field>
                          <Field label="Email">
                            <Input type="email" value={player.email} onChange={(event) => updatePlayer(index, 'email', event.target.value)} />
                          </Field>
                          <Field label="Roll number">
                            <Input value={player.roll_number} onChange={(event) => updatePlayer(index, 'roll_number', event.target.value)} />
                          </Field>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {message ? <p className="notice text-sm">{message}</p> : null}
                {error ? <p className="error text-sm">{error}</p> : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
                    Already registered? Go to login
                  </Link>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Saving team...' : 'Register team'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {icon}
      <span>{title}</span>
    </div>
  );
}

function InfoPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/45 p-4">
      <p className="font-medium text-white">{title}</p>
      <p className="mt-2">{description}</p>
    </div>
  );
}
