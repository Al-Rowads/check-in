import { FormEvent, useState } from "react";
import { DEFAULT_USERNAME } from "../config/auth";
import { Button } from "./Button";
import { Field, TextInput } from "./Field";

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
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-soft sm:p-8">
        <div className="mb-8 grid gap-2">
          <p className="text-sm font-bold uppercase text-teal-700">
            Event Check-In
          </p>
          <h1 className="text-3xl font-bold text-stone-950">Admin login</h1>
        </div>

        <form className="grid gap-5" onSubmit={handleSubmit}>
          <Field label="Username">
            <TextInput
              autoComplete="username"
              autoFocus
              onChange={(event) => setUsername(event.target.value)}
              value={username}
            />
          </Field>

          <Field label="Password">
            <TextInput
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </Field>

          {error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
              {error}
            </div>
          ) : null}

          <Button className="w-full" disabled={isLoggingIn} type="submit">
            {isLoggingIn ? "Logging in..." : "Log in"}
          </Button>
        </form>
      </section>
    </main>
  );
}
