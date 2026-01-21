"use client";

import { Chip } from "@ui/Chip";
import FormattedText from "@ui/FormattedText";
import { useRouter } from "next/navigation";
import type { DatasetPlus } from "@/data/dataset";
import { getNavigationUrl } from "@/lib/utils";
import styles from "./DatasetRecommendationsSection.module.scss";

const RECOMMENDATIONS_COUNT = 6;
type MockRecommendation = DatasetPlus & { displayCategory: string };

const mockRecommendations: MockRecommendation[] = [
  {
    id: "recommendation-1",
    title: "ERA5 Land",
    category: "Weather",
    displayCategory: "Navigation",
    access: "Open Access",
    description:
      "Galileo provides high-precision satellite navigation services, supporting various applications in transport, agriculture, and emergency response globally since its launch in 2016.",
    size: "N/A",
    lastUpdated: "2024-01-01",
    tags: [],
    collections: [],
  },
  {
    id: "recommendation-2",
    title: "Horizon Europe",
    category: "Weather",
    displayCategory: "Research",
    access: "Open Access",
    description:
      "Horizon Europe is the EU's key funding program for research and innovation, aiming to enhance scientific excellence and tackle societal challenges, fostering collaboration across disciplines since 2021.",
    size: "N/A",
    lastUpdated: "2024-01-01",
    tags: [],
    collections: [],
  },
  {
    id: "recommendation-3",
    title: "Copernicus",
    category: "Weather",
    displayCategory: "Weather",
    access: "Open Access",
    description:
      "The Copernicus program offers comprehensive data from its Sentinel satellites, enabling detailed monitoring of land, ocean, and atmosphere. It's crucial for climate change assessment and disaster management since 2014.",
    size: "N/A",
    lastUpdated: "2024-01-01",
    tags: [],
    collections: [],
  },
  {
    id: "recommendation-4",
    title: "EUREKA",
    category: "Weather",
    displayCategory: "Innovation",
    access: "Open Access",
    description:
      "EUREKA is an intergovernmental network that supports market-oriented R&D, promoting innovation initiatives across Europe since 1985, enhancing competitiveness and economic growth.",
    size: "N/A",
    lastUpdated: "2024-01-01",
    tags: [],
    collections: [],
  },
  {
    id: "recommendation-5",
    title: "Digital Europe",
    category: "Weather",
    displayCategory: "Technology",
    access: "Open Access",
    description:
      "Digital Europe is a funding program focused on accelerating digital transformation in Europe, aiming to equip the EU with advanced digital skills and infrastructure since 2021.",
    size: "N/A",
    lastUpdated: "2024-01-01",
    tags: [],
    collections: [],
  },
  {
    id: "recommendation-6",
    title: "Fifth Space Weather Services",
    category: "Weather",
    displayCategory: "Space Monitoring",
    access: "Open Access",
    description:
      "The Fifth Space Weather Services program aims to enhance the prediction and monitoring of space weather phenomena to protect technological infrastructure and improve safety since 2022.",
    size: "N/A",
    lastUpdated: "2024-01-01",
    tags: [],
    collections: [],
  },
];

export default function DatasetRecommendationsSection() {
  const router = useRouter();

  const handleCardClick = (dataset: DatasetPlus) => {
    router.push(getNavigationUrl(`/datasets/${dataset.id}`));
  };

  const getDisplayCategory = (dataset: MockRecommendation): string =>
    dataset.displayCategory || dataset.category;

  return (
    <div className={styles.datasetRecommendationsSection}>
      <h3 className={styles.datasetRecommendationsSection__title}>
        You may also like
      </h3>
      <div className={styles.datasetRecommendationsSection__grid}>
        {mockRecommendations.slice(0, RECOMMENDATIONS_COUNT).map((dataset) => (
          <div
            key={dataset.id}
            className={styles.datasetRecommendationsSection__card}
            onClick={() => handleCardClick(dataset)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCardClick(dataset);
              }
            }}
            aria-label={`View details for ${dataset.title}`}
          >
            <div className={styles.datasetRecommendationsSection__cardContent}>
              <div className={styles.datasetRecommendationsSection__cardHeader}>
                <h4 className={styles.datasetRecommendationsSection__cardTitle}>
                  {dataset.title}
                </h4>
                <div
                  className={styles.datasetRecommendationsSection__cardChips}
                >
                  <Chip color="info" variant="outline" size="sm">
                    {getDisplayCategory(dataset)}
                  </Chip>
                  <Chip
                    color={
                      dataset.access === "Open Access" ? "success" : "warning"
                    }
                    size="sm"
                  >
                    {dataset.access}
                  </Chip>
                </div>
              </div>
              <FormattedText
                as="p"
                className={
                  styles.datasetRecommendationsSection__cardDescription
                }
                text={dataset.description || ""}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
