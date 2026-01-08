import Link from "next/link";
import { APP_ROUTES } from "@/config/appUrls";
import { createUrl } from "@/lib/utils";

interface LogoProps {
  isMobile?: boolean;
  className?: string;
}

export function Logo({
  isMobile = false,
  className = "h-6 w-auto",
}: LogoProps) {
  const logoSrc = isMobile ? "mobile-logo.svg" : "logo.svg";

  return (
    <Link
      href={createUrl(APP_ROUTES.BROWSE)}
      className="flex items-center gap-2"
    >
      <img
        src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/${logoSrc}`}
        alt="Logo"
        className={className}
      />
    </Link>
  );
}
