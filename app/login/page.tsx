import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand font-bold text-white">
            C
          </span>
          <span className="font-semibold">Creditable Partner</span>
        </div>

        {isSupabaseConfigured ? (
          <LoginForm />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Running in <strong>demo mode</strong> — no login required.
            </p>
            <Link
              href="/"
              className="block rounded-lg bg-brand px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Enter dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
