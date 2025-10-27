export interface Dataset {
  id: string;
  title: string;
  category: "Weather" | "Math" | "Lifelong Learning" | "Language";
  access: "Open Access" | "Restricted";
  description: string;
  size: string;
  lastUpdated: string;
  tags: string[];
  license?: string;
  mimeType?: string;
  datePublished?: string;
  fieldOfScience?: string[];
  keywords?: string[];
  url?: string;
}

export type DatasetPlus = Dataset & {
  collections?: { id: string; name: string; code: string }[];
  license?: string;
  mimeType?: string;
  fieldOfScience?: string[];
  datePublished?: string;
  keywords?: string[];
  url?: string;
  version?: string;
  maxSimilarity?: number;
};

export type DatasetWithCollections = Dataset & { collections?: Collection[] };
export type Collection = { id: string; name: string, code: string };


export const mockDatasets: Dataset[] = [
  {
    id: "1",
    title: "ERA5land",
    category: "Weather",
    access: "Open Access",
    description:
      "The ERA5-Land is a global atmospheric reanalysis dataset. It includes main meteorological parameters from 1950 up to the most recent month, gridded values at a spatial resolution of 0.1° x 0.1°, hourly values.",
    size: "2.4 GB",
    lastUpdated: "2024-03-15",
    datePublished: "2023-01-15",
    tags: ["meteorology", "atmospheric", "reanalysis", "hourly"],
  },
  {
    id: "2",
    title: "Historical meteorological data-METEO-NOA",
    category: "Weather",
    access: "Restricted",
    description:
      "Data base of surface weather observations in Greece. It includes main meteorological parameters from 2010-2024, in situ data, daily values.",
    size: "1.2 TB",
    lastUpdated: "2023-04-01",
    datePublished: "2022-06-10",
    tags: ["meteorology", "greece", "surface", "daily"],
  },
  {
    id: "3",
    title: "On-line meteorological data-METEO-NOA",
    category: "Weather",
    access: "Restricted",
    description:
      "On-line updated values from a network of 550 meteorological stations, updated every 10 min. Values include temperature, wind, precipitation.",
    size: "850 MB",
    lastUpdated: "2022-08-20",
    datePublished: "2021-12-05",
    tags: ["meteorology", "real-time", "stations", "10min"],
  },
  {
    id: "4",
    title: "Global Climate Models Dataset",
    category: "Weather",
    access: "Open Access",
    description:
      "Comprehensive collection of global climate model outputs from CMIP6. Includes temperature, precipitation, and atmospheric data for climate research.",
    size: "5.7 TB",
    lastUpdated: "2021-11-30",
    datePublished: "2020-09-15",
    tags: ["climate", "models", "cmip6", "global"],
  },
  {
    id: "5",
    title: "Advanced Mathematical Functions Library",
    category: "Math",
    access: "Open Access",
    description:
      "Comprehensive dataset of mathematical functions, algorithms, and computational models for research and educational purposes.",
    size: "45 MB",
    lastUpdated: "2024-01-10",
    datePublished: "2023-08-22",
    tags: ["mathematics", "algorithms", "functions", "computational"],
  },
  {
    id: "6",
    title: "Statistical Analysis Toolkit",
    category: "Math",
    access: "Restricted",
    description:
      "Professional statistical analysis tools and datasets for advanced mathematical research. Includes regression models, time series analysis, and probability distributions.",
    size: "180 MB",
    lastUpdated: "2023-09-12",
    datePublished: "2023-05-18",
    tags: ["statistics", "analysis", "probability", "regression"],
  },
  {
    id: "7",
    title: "Linear Algebra Computational Framework",
    category: "Math",
    access: "Open Access",
    description:
      "High-performance linear algebra computations and matrix operations dataset. Optimized for large-scale mathematical operations.",
    size: "320 MB",
    lastUpdated: "2022-05-18",
    datePublished: "2022-01-10",
    tags: ["linear-algebra", "matrices", "computation", "optimization"],
  },
  {
    id: "8",
    title: "Online Learning Engagement Metrics",
    category: "Lifelong Learning",
    access: "Restricted",
    description:
      "Comprehensive analytics on online learning engagement patterns, course completion rates, and educational outcomes across multiple platforms.",
    size: "1.8 GB",
    lastUpdated: "2024-02-28",
    datePublished: "2023-11-15",
    tags: ["education", "analytics", "engagement", "learning"],
  },
  {
    id: "9",
    title: "Professional Development Pathways",
    category: "Lifelong Learning",
    access: "Open Access",
    description:
      "Career development and skill progression datasets for various professional fields. Includes certification paths and competency frameworks.",
    size: "95 MB",
    lastUpdated: "2023-07-22",
    datePublished: "2023-04-08",
    tags: ["career", "skills", "development", "certification"],
  },
  {
    id: "10",
    title: "Microlearning Effectiveness Study",
    category: "Lifelong Learning",
    access: "Open Access",
    description:
      "Research data on microlearning effectiveness across different age groups and learning contexts. Longitudinal study spanning 3 years.",
    size: "410 MB",
    lastUpdated: "2021-12-05",
    datePublished: "2021-08-20",
    tags: ["microlearning", "effectiveness", "research", "longitudinal"],
  },
  {
    id: "11",
    title: "Multilingual Natural Language Corpus",
    category: "Language",
    access: "Open Access",
    description:
      "Extensive multilingual text corpus covering 45 languages with grammatical annotations, semantic tags, and cross-linguistic analysis.",
    size: "3.2 GB",
    lastUpdated: "2024-01-25",
    datePublished: "2023-10-12",
    tags: ["multilingual", "nlp", "corpus", "linguistics"],
  },
  {
    id: "12",
    title: "Speech Recognition Training Dataset",
    category: "Language",
    access: "Restricted",
    description:
      "High-quality audio recordings with transcriptions for speech recognition model training. Covers multiple accents and speaking conditions.",
    size: "8.9 GB",
    lastUpdated: "2023-11-08",
    datePublished: "2023-07-25",
    tags: ["speech", "recognition", "audio", "transcription"],
  },
  {
    id: "13",
    title: "Historical Language Evolution Archive",
    category: "Language",
    access: "Open Access",
    description:
      "Diachronic language change dataset tracking linguistic evolution over centuries. Includes phonetic, semantic, and syntactic changes.",
    size: "670 MB",
    lastUpdated: "2022-03-14",
    datePublished: "2021-12-30",
    tags: ["historical", "evolution", "diachronic", "linguistics"],
  },
  {
    id: "14",
    title: "Real-time Translation Evaluation Metrics",
    category: "Language",
    access: "Restricted",
    description:
      "Quality assessment data for machine translation systems across language pairs. Includes BLEU scores, human evaluations, and error analysis.",
    size: "125 MB",
    lastUpdated: "2023-06-30",
    datePublished: "2023-03-15",
    tags: ["translation", "evaluation", "metrics", "quality"],
  },
];
