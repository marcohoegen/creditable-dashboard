"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RANGE_KEYS, type RangeKey } from "@/lib/range";

export default function RangePicker({ value }: { value: RangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function select(key: RangeKey) {
    const next = new URLSearchParams(params);
    next.set("range", key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="inline-flex rounded-lg border bg-white p-0.5 text-sm">
      {RANGE_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => select(key)}
          className={`rounded-md px-3 py-1 font-medium transition ${
            value === key
              ? "bg-brand text-white"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          {key}d
        </button>
      ))}
    </div>
  );
}
