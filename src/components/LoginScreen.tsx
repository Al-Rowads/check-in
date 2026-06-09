import { FormEvent, useState } from "react";
import { AlertTriangle, ArrowRight, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { DEFAULT_USERNAME } from "../config/auth";
import { Button } from "./Button";
import { Field, TextInput } from "./Field";
import { BrandMark, Panel, StatusPill } from "./ui";

type LoginScreenProps = {
  onLogin: (
    username: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
};

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState<string>(DEFAULT_USERNAME);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoggingIn(true);

    const result = await onLogin(username, password);

    if (!result.ok) {
      setError(result.message);
      setIsLoggingIn(false);
      return;
    }

    setError(null);
    setIsLoggingIn(false);
  }

  return (
    <main className="grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <section className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(24rem,0.7fr)] lg:items-stretch">
        <div className="flex min-h-[28rem] flex-col justify-between rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgb(232_80_2/0.18),rgb(0_0_0/0.96)_42%,rgb(51_51_51/0.36))] p-6 shadow-console sm:p-8">
          <BrandMark />
          <div className="mt-16 max-w-xl">
            <StatusPill icon={<ShieldCheck aria-hidden="true" className="size-4" />} tone="orange">
              Secure desk access
            </StatusPill>
            <h1 className="mt-5 max-w-lg text-4xl font-semibold leading-tight text-alrowad-white sm:text-5xl">
              Fast entry decisions for the front door.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-white/58">
              Search arrivals, confirm payment status, and keep the active roster in sync from one focused console.
            </p>
          </div>
        </div>

        <Panel className="self-center p-6 sm:p-7" tone="default">
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-alrowad-orange">
              Console login
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-alrowad-white">
              Welcome back
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/52">
              Use your event credentials to unlock the check-in desk.
            </p>
          </div>

          <form className="grid gap-5" onSubmit={handleSubmit}>
            <Field label="Username">
              <div className="relative">
                <UserRound
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-white/36"
                />
                <TextInput
                  autoComplete="username"
                  autoFocus
                  className="pl-11"
                  onChange={(event) => setUsername(event.target.value)}
                  value={username}
                />
              </div>
            </Field>

            <Field label="Password">
              <div className="relative">
                <LockKeyhole
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-white/36"
                />
                <TextInput
                  autoComplete="current-password"
                  className="pl-11"
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </div>
            </Field>

            {error ? (
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-alrowad-red/40 bg-alrowad-red/14 px-3 py-3 text-sm font-semibold text-red-50">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 text-red-100" />
                <span>{error}</span>
              </div>
            ) : null}

            <Button
              className="w-full"
              isLoading={isLoggingIn}
              rightIcon={<ArrowRight aria-hidden="true" className="size-4" />}
              size="lg"
              type="submit"
            >
              {isLoggingIn ? "Logging in" : "Log in"}
            </Button>
          </form>
        </Panel>
      </section>
    </main>
  );
}
