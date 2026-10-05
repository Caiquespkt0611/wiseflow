import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";
import { LancadorGlobal } from "@/components/lancar/LancadorGlobal";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <ToastProvider>
      <LancadorGlobal>
        <div className="flex min-h-[100dvh] bg-tinta-50">
          <Sidebar userName={session.user.name ?? session.user.email ?? ""} />
          <main className="flex-1 min-w-0 lg:ml-64 pt-mobile-content pb-mobile-content px-4 lg:px-10 lg:py-10 overflow-x-hidden">
            {children}
          </main>
        </div>
      </LancadorGlobal>
    </ToastProvider>
  );
}
