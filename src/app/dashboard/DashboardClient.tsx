"use client";

import {
  BookOpen,
  Calculator,
  CloudSun,
  FolderSearch,
  Languages,
  MapPin,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tooltip } from "@/components/ui/Tooltip";
import { APP_ROUTES } from "@/config/appUrls";
import { useUser } from "@/contexts/UserContext";
import { createUrl } from "@/lib/utils";

interface UseCaseCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  href: string;
}

function UseCaseCard({
  title,
  description,
  icon,
  iconBg,
  href,
}: UseCaseCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between flex-1 min-w-0">
      <div
        className={`${iconBg} rounded-lg p-2 w-11 h-11 flex items-center justify-center mb-4`}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-2 mb-5">
        <p className="text-body-16-semibold text-gray-800">{title}</p>
        <p className="text-body-14-regular text-gray-500">{description}</p>
      </div>
      <Link
        href={href}
        className="border border-slate-300 shadow-s1 rounded-full h-10 flex items-center justify-center hover:shadow-s2 transition-shadow"
      >
        <span className="text-body-14-medium text-gray-700">
          Browse Datasets
        </span>
      </Link>
    </div>
  );
}

interface ComingSoonCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
}

function ComingSoonCard({
  title,
  description,
  icon,
  iconBg,
}: ComingSoonCardProps) {
  return (
    <Tooltip
      content="Coming soon"
      position="top"
      delay={200}
      className="flex-1 min-w-0 flex"
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 w-full cursor-default opacity-80"
        style={{ pointerEvents: "none" }}
      >
        <div
          className={`${iconBg} rounded-lg p-2 w-11 h-11 flex items-center justify-center`}
        >
          {icon}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-body-16-semibold text-gray-800">{title}</p>
          <p className="text-body-14-regular text-gray-500">{description}</p>
        </div>
      </div>
    </Tooltip>
  );
}

export default function DashboardClient() {
  const { userData } = useUser();

  const firstName = userData.name || "there";

  const useCaseCards: UseCaseCardProps[] = [
    {
      title: "Ask Weather Question",
      description: "Explore forecasts and weather insights using AI.",
      icon: <CloudSun strokeWidth={1.25} className="w-5 h-5 text-purple-500" />,
      iconBg: "bg-purple-50",
      href: APP_ROUTES.USE_CASES.WEATHER_HOME,
    },
    {
      title: "Ask Math Question",
      description: "Solve complex math problems with AI.",
      icon: (
        <Calculator strokeWidth={1.25} className="w-5 h-5 text-emerald-600" />
      ),
      iconBg: "bg-emerald-50",
      href: APP_ROUTES.USE_CASES.MATH_HOME,
    },
    {
      title: "Ask Lifelong Learning Question",
      description: "Expand your skills and knowledge with AI.",
      icon: <BookOpen strokeWidth={1.25} className="w-5 h-5 text-rose-500" />,
      iconBg: "bg-rose-50",
      href: APP_ROUTES.USE_CASES.LIFELONG_LEARNING,
    },
    {
      title: "Ask Language Question",
      description: "Language-related questions and AI-power.",
      icon: <Languages strokeWidth={1.25} className="w-5 h-5 text-amber-600" />,
      iconBg: "bg-amber-50",
      href: APP_ROUTES.USE_CASES.LANGUAGE_HOME,
    },
  ];

  const comingSoonCards: ComingSoonCardProps[] = [
    {
      title: "Weather Station Map",
      description: "Time-series analysis and sensor health monitoring.",
      icon: <MapPin strokeWidth={1.25} className="w-5 h-5 text-purple-500" />,
      iconBg: "bg-purple-50",
    },
    {
      title: "Identify missing skills",
      description:
        "Identify missing skills in your profile, check skills forecast and more.",
      icon: <TrendingUp strokeWidth={1.25} className="w-5 h-5 text-rose-500" />,
      iconBg: "bg-rose-50",
    },
    {
      title: "Explore linguistic trends",
      description:
        "Ask a natural language question to explore linguistic trends and concepts.",
      icon: <Sparkles strokeWidth={1.25} className="w-5 h-5 text-amber-600" />,
      iconBg: "bg-amber-50",
    },
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 py-10 px-8 max-w-[900px] mx-auto w-full">
        {/* Greeting */}
        <div className="flex flex-col">
          <h1 className="text-H2-32-semibold text-gray-700">
            Hello, {firstName}!
          </h1>
          <p className="text-H2-20-regular text-gray-500">
            Check all the features of the DataGems platform
          </p>
        </div>

        {/* Primary Actions */}
        <div className="flex flex-col gap-5">
          <h2 className="text-H6-18-semibold text-gray-700">Primary Actions</h2>

          {/* Browse All Datasets — full width */}
          <Link
            href={createUrl(APP_ROUTES.BROWSE)}
            className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 hover:shadow-s2 transition-shadow"
          >
            <div className="bg-blue-50 rounded-lg p-2 w-11 h-11 flex items-center justify-center shrink-0">
              <FolderSearch
                strokeWidth={1.25}
                className="w-5 h-5 text-blue-500"
              />
            </div>
            <div className="flex flex-col">
              <p className="text-body-16-semibold text-gray-800">
                Browse All Datasets
              </p>
              <p className="text-body-14-regular text-gray-500">
                Explore and manage available datasets.
              </p>
            </div>
          </Link>

          {/* Use-case cards */}
          <div className="flex gap-5 items-stretch">
            {useCaseCards.map((card) => (
              <UseCaseCard key={card.title} {...card} />
            ))}
          </div>
        </div>

        {/* Explore more features */}
        <div className="flex flex-col gap-5">
          <h2 className="text-H6-18-semibold text-gray-700">
            Explore more features
          </h2>
          <div className="flex gap-5 items-stretch">
            {comingSoonCards.map((card) => (
              <ComingSoonCard key={card.title} {...card} />
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
