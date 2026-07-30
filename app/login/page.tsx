import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/login/LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session.userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-primary">Grupo Pagasa</h1>
          <p className="text-sm text-ink">Sistema Integral de Mantenimiento</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
