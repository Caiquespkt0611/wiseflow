import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar userName={session.user.name ?? session.user.email ?? ""} />
      <main className="flex-1 min-w-0 lg:ml-64 pt-mobile-content px-4 pb-4 lg:p-8 overflow-x-hidden">{children}</main>
    </div>
  );
}
