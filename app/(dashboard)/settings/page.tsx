import { redirect } from "next/navigation";
import SettingsForm from "@/components/settings/SettingsForm";
import { getCurrentRestaurant } from "@/lib/session";
import { getDashboardData } from "@/lib/reservations";

export default async function SettingsPage() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/login");

  const { hours } = await getDashboardData(restaurant);

  return (
    <div className="max-w-3xl space-y-4">
      <header>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-gray-500">
          Profile, no-show fee and cancellation policy, opening hours
        </p>
      </header>
      <SettingsForm restaurant={restaurant} hours={hours} />
    </div>
  );
}
