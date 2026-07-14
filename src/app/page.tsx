import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <section className="panel narrow">
        <h1>Market Mayhem</h1>
        <p>Simple UI for testing team and admin APIs.</p>
        <div className="row wrap">
          <Link className="buttonLink" href="/login">Team login</Link>
          <Link className="buttonLink secondary" href="/admin/login">Admin login</Link>
          <Link className="buttonLink secondary" href="/dashboard">Team dashboard</Link>
          <Link className="buttonLink secondary" href="/admin">Admin console</Link>
        </div>
      </section>
    </main>
  );
}
