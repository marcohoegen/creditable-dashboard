"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview", icon: "▦" },
  { href: "/reservations", label: "Reservations", icon: "▤" },
  { href: "/analytics", label: "Analytics", icon: "▣" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export default function Sidebar({ restaurantName }: { restaurantName: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r bg-white">
      <div className="flex items-center gap-2 border-b px-4 py-4">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand font-bold text-white">
          C
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Creditable</p>
          <p className="text-xs text-gray-400">Partner</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-brand-light text-brand-dark"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t px-4 py-3">
        <p className="truncate text-xs font-medium text-gray-700">
          {restaurantName}
        </p>
        <p className="text-xs text-gray-400">Signed in</p>
      </div>
    </aside>
  );
}
