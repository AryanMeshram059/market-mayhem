import Link from 'next/link';
import { Shield, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <main className="dark flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-3xl">
        <div className="mb-8">
          <p className="font-mono text-sm uppercase tracking-widest text-primary">Market Mayhem</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Trading game console</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Sign in with the role assigned to you for the current simulation.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono">
                <TrendingUp className="size-5 text-primary" />
                Teams
              </CardTitle>
              <CardDescription>Open the market and manage your portfolio.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link className="buttonLink w-full" href="/login">
                Team Login
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono">
                <Shield className="size-5 text-primary" />
                Admin
              </CardTitle>
              <CardDescription>Control rounds, teams, schedules, and approvals.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link className="buttonLink secondary w-full" href="/admin/login">
                Admin Login
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
