import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getCurrentRestaurant, isDemoMode } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar restaurantName={restaurant.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        {isDemoMode() && (
          <div className="bg-amber-100 px-6 py-1.5 text-center text-xs font-medium text-amber-800">
            Demo mode — showing synthetic data. Connect Supabase to see live
            reservations.
          </div>
        )}
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
