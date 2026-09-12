/** Sign-in and registration: no shell, one centred box. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-navy">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 text-[15px] font-bold text-white">
          <span className="inline-block h-6 w-6 rounded-sm bg-green-bright" /> Contest
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12">{children}</main>
    </div>
  );
}
