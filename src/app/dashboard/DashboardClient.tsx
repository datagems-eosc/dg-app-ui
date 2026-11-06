"use client";

import { BookOpen, Calculator, CloudSun, Languages } from "lucide-react";
import Link from "next/link";
import type React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { HomeQuery } from "@/components/HomeQuery/HomeQuery";
import { APP_ROUTES } from "@/config/appUrls";
import type { FeatureFlagId } from "@/config/featureFlags";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useUser } from "@/contexts/UserContext";
import { createUrl } from "@/lib/utils";

interface TopicCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  href: string;
  flag: FeatureFlagId;
}

function TopicCard({ title, description, icon, iconBg, href }: TopicCardProps) {
  return (
    <Link
      href={createUrl(href)}
      className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 min-w-0 hover:shadow-s2 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-850 focus-visible:ring-offset-1"
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
    </Link>
  );
}

const topicCards: TopicCardProps[] = [
  {
    title: "Weather",
    description: "Weather records and climate data.",
    icon: <CloudSun strokeWidth={1.25} className="w-5 h-5 text-purple-500" />,
    iconBg: "bg-purple-50",
    href: APP_ROUTES.USE_CASES.WEATHER_HOME,
    flag: "useCaseWeather",
  },
  {
    title: "MathE",
    description: "Mathematics learning datasets.",
    icon: (
      <Calculator strokeWidth={1.25} className="w-5 h-5 text-emerald-600" />
    ),
    iconBg: "bg-emerald-50",
    href: APP_ROUTES.USE_CASES.MATH_HOME,
    flag: "useCaseMath",
  },
  {
    title: "Lifelong Learning",
    description: "Skills, jobs and training data.",
    icon: <BookOpen strokeWidth={1.25} className="w-5 h-5 text-rose-500" />,
    iconBg: "bg-rose-50",
    href: APP_ROUTES.USE_CASES.LIFELONG_LEARNING,
    flag: "useCaseLifelongLearning",
  },
  {
    title: "Language",
    description: "Language corpora and word trends.",
    icon: <Languages strokeWidth={1.25} className="w-5 h-5 text-amber-600" />,
    iconBg: "bg-amber-50",
    href: APP_ROUTES.USE_CASES.LANGUAGE_HOME,
    flag: "useCaseLanguage",
  },
];

export default function DashboardClient() {
  const { userData } = useUser();
  const { flags } = useFeatureFlags();

  const firstName = userData.name || "there";
  const visibleTopics = topicCards.filter((card) => flags[card.flag]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 py-10 px-4 sm:px-8 max-w-[900px] mx-auto w-full">
        <div className="flex flex-col">
          <h1 className="text-H2-32-semibold text-gray-700">
            Hello, {firstName}!
          </h1>
          <p className="text-H2-20-regular text-gray-500">
            Search datasets or ask a question about data
          </p>
        </div>

        <HomeQuery />

        {visibleTopics.length > 0 && (
          <section
            aria-labelledby="home-topics-title"
            className="@container flex flex-col gap-5"
          >
            <h2
              id="home-topics-title"
              className="text-H6-18-semibold text-gray-700"
            >
              Explore by topic
            </h2>
            <div className="grid grid-cols-1 @sm:grid-cols-2 @3xl:grid-cols-4 gap-5">
              {visibleTopics.map((card) => (
                <TopicCard key={card.title} {...card} />
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
