import { redirect } from "next/navigation";
import ReservationsView from "@/components/reservations/ReservationsView";
import { getCurrentRestaurant } from "@/lib/session";
import { getDashboardData } from "@/lib/reservations";

export default async function ReservationsPage() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/login");

  const { reservations } = await getDashboardData(restaurant);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Reservations</h1>
        <p className="text-sm text-gray-500">
          Manage bookings · mark guests showed or no-show to settle deposits
        </p>
      </header>
      <ReservationsView
        initial={reservations}
        restaurant={{
          id: restaurant.id,
          name: restaurant.name,
          deposit_amount: restaurant.deposit_amount,
        }}
      />
    </div>
  );
}
