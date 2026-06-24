"use client";

import { Database, House, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Home", href: "/use-case/math/home", Icon: House },
  { label: "Chat", href: "/use-case/math/chat", Icon: MessageCircle },
  { label: "Datasets", href: "/use-case/math/datasets", Icon: Database },
] as const;

export default function MathTabBar() {
  const pathname = usePathname();
  return (
    <div className="bg-white border-b border-[#e2e8f0] flex h-14 items-start justify-center px-5 w-full shrink-0">
      <div className="flex gap-4 items-center w-full max-w-[900px]">
        {TABS.map(({ label, href, Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="relative flex h-[55px] items-end justify-center"
            >
              <div className="flex gap-1.5 items-center h-full justify-center px-2">
                <Icon
                  size={16}
                  className={isActive ? "text-[#2b7fff]" : "text-[#5b708f]"}
                />
                <span
                  className={`text-base font-medium leading-[1.5] whitespace-nowrap ${isActive ? "text-[#314158]" : "text-[#5b708f]"}`}
                >
                  {label}
                </span>
              </div>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#2b7fff] rounded-tl-sm rounded-tr-sm" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
