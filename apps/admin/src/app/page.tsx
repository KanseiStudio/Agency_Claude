import { auth, signOut } from '@/auth';
import type { Locale, ProjectStatus, ProjectType } from '@kansei/shared';
import { prisma } from '@kansei/database';

// Server component async: legge sessione corrente + conteggi DB.
export default async function Home() {
  const session = await auth();

  const locale: Locale = 'it';
  const status: ProjectStatus = 'in_attesa_approvazione_admin';
  const type: ProjectType = 'one_shot';

  const [userCount, pricingCount, servicesCount, policiesCount] = await Promise.all([
    prisma.user.count(),
    prisma.pricingModel.count(),
    prisma.serviceCatalog.count(),
    prisma.approvalPolicy.count(),
  ]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-12 font-sans dark:bg-black">
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              Kansei-Studio Agency
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Dashboard Admin
            </h1>
          </div>

          {session?.user ? (
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Esci
              </button>
            </form>
          ) : null}
        </div>

        {session?.user ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Loggato come{' '}
            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-50">
              {session.user.email}
            </span>{' '}
            · ruolo{' '}
            <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
              {session.user.role}
            </span>
          </p>
        ) : null}

        <div className="mt-8 space-y-6">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Tipi condivisi (@kansei/shared)
            </h2>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card label="Locale" value={locale} />
              <Card label="Project status" value={status} />
              <Card label="Project type" value={type} />
            </dl>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Conteggi dal DB MySQL
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card label="users" value={String(userCount)} highlight />
              <Card label="pricing models" value={String(pricingCount)} highlight />
              <Card label="services" value={String(servicesCount)} highlight />
              <Card label="approval policies" value={String(policiesCount)} highlight />
            </dl>
          </section>
        </div>
      </div>
    </main>
  );
}

function Card({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? 'rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950'
          : 'rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900'
      }
    >
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd
        className={
          highlight
            ? 'mt-1 font-mono text-lg font-semibold text-emerald-900 dark:text-emerald-100'
            : 'mt-1 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50'
        }
      >
        {value}
      </dd>
    </div>
  );
}
