"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import type { DatasetPackage } from "@/data/package";
import type { DatasetUnion } from "@/types/datasets";
import PackageCard from "../PackageCard";
import styles from "./PackageCarousel.module.scss";

const CARDS_PER_SLIDE = 2;

interface PackageCarouselProps {
  packages: DatasetPackage[];
  datasets: DatasetUnion[];
  selectedPackageIds: string[];
  onSelectPackage: (packageId: string) => void;
  onDeselectPackage: (packageId: string) => void;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export default function PackageCarousel({
  packages,
  datasets,
  selectedPackageIds,
  onSelectPackage,
  onDeselectPackage,
}: PackageCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = chunk(packages, CARDS_PER_SLIDE);
  const canGoPrev = slideIndex > 0;
  const canGoNext = slideIndex < slides.length - 1;

  const goPrev = () => {
    if (!canGoPrev) return;
    setSlideIndex((i) => i - 1);
  };

  const goNext = () => {
    if (!canGoNext) return;
    setSlideIndex((i) => i + 1);
  };

  return (
    <div
      className={styles.carouselWrapper}
      role="region"
      aria-label="Dataset packages carousel"
    >
      {packages.length > 0 ? (
        <>
          <div
            ref={scrollRef}
            className={styles.scrollContainer}
            style={{
              overflow: "hidden",
            }}
          >
            <div
              className={styles.slidesTrack}
              style={{
                transform: `translateX(-${slideIndex * 100}%)`,
              }}
            >
              {slides.map((slidePackages, idx) => (
                <div key={idx} className={styles.slide}>
                  {slidePackages.map((pkg) => (
                    <div key={pkg.id} className={styles.cardWrapper}>
                      <PackageCard
                        datasetPackage={pkg}
                        datasets={datasets}
                        isSelected={selectedPackageIds.includes(pkg.id)}
                        onSelectPackage={onSelectPackage}
                        onDeselectPackage={onDeselectPackage}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.arrowsWrapper}>
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev}
              className={styles.arrowButton}
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className={styles.arrowButton}
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5" aria-hidden />
            </button>
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>No packages match your search</div>
      )}
    </div>
  );
}
