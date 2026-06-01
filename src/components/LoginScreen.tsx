import { FormEvent, useState } from "react";
import { ADMIN_CREDENTIALS } from "../config/auth";
import { Button } from "./Button";
import { Field, TextInput } from "./Field";

type LoginScreenProps = {
  onLogin: (username: string, password: string) => { ok: true } | { ok: false; message: string };
};

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState<string>(ADMIN_CREDENTIALS.username);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = onLogin(username, password);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError(null);
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

          <Button className="w-full" type="submit">
            Log in
          </Button>
        </form>
      </section>
    </main>
  );
}
