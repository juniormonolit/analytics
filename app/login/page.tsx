import { Suspense } from "react";

import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
          <div className="text-sm text-text-secondary">Загрузка…</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
