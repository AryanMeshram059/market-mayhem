import Link from 'next/link';
import { ArrowRight, ClipboardList, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <main className="dark min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.18),_transparent_32%),radial-gradient(circle_at_85%_15%,_rgba(245,158,11,0.12),_transparent_24%),linear-gradient(180deg,_rgba(15,17,16,0.98),_rgba(8,10,9,1))]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-6 py-10 md:px-10">
        <div className="max-w-3xl space-y-5">
          <Badge variant="outline" className="border-primary/40 bg-primary/10 px-3 py-1 font-mono tracking-[0.28em] text-primary">
            MARKET MAYHEM
          </Badge>
          <div className="space-y-4">
            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.04em] text-white md:text-7xl">
              Register your team, then enter the trading floor.
            </h1>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <ActionCard
            href="/register"
            icon={<ClipboardList className="size-5 text-primary" />}
            title="Registration"
            description="Create and store a team with captain and player details in the database."
            cta="Open registration"
          />
          <ActionCard
            href="/login"
            icon={<TrendingUp className="size-5 text-primary" />}
            title="Login"
            description="Use your team name or team code with the saved password to enter the website game."
            cta="Open login"
          />
        </div>
      </div>
    </main>
  );
}

function ActionCard({
  href,
  icon,
  title,
  description,
  cta,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full border-border/70 bg-card/90 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur transition duration-200 group-hover:border-primary/50 group-hover:bg-card">
        <CardHeader className="gap-4">
          <div className="flex size-11 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
            {icon}
          </div>
          <div>
            <CardTitle className="text-2xl text-white">{title}</CardTitle>
            <CardDescription className="mt-2 text-sm leading-6">{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="inline-flex items-center gap-2 font-mono text-sm text-primary">
            {cta}
            <ArrowRight className="size-4 transition group-hover:translate-x-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
