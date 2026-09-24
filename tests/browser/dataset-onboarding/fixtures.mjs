/**
 * Synthetic data for the dataset onboarding browser journey. Shapes follow the
 * adapter fixtures the accepted library is tested against. Nothing here is a
 * real account, dataset, process or credential.
 */

/** `.invalid` never resolves, so a missed intercept cannot leak. */
export const GATEWAY = "https://gateway.synthetic.invalid";

export const ACCOUNT_A = {
  id: "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380",
  name: "Synthetic Uploader A",
  email: "uploader-a@synthetic.invalid",
  token: "synthetic-token-a",
};

export const ACCOUNT_B = {
  id: "7e21c9b0-4a58-4c3d-9f16-2b8e0d4a6c71",
  name: "Synthetic Uploader B",
  email: "uploader-b@synthetic.invalid",
  token: "synthetic-token-b",
};

export const PROCESS_ID = "3f2a1d64-0c5b-4d8e-9a31-7b6c2e5f0a14";
export const DATASET_ID = "c1b9e4a7-5d23-4f80-8e6a-9f0d3b7c1e52";
export const DATASET_NAME = "Sensor readings 2026";
export const STAGED = "/storage/datagems/gw/dataset_upload/readings.csv";

export const FILE = {
  name: "readings.csv",
  mimeType: "text/csv",
  buffer: Buffer.from("a,b\n1,2\n"),
};

const STEP = {
  onboarding: "8352e21f-a84f-4d41-92c8-30dc05577235",
  profiling: "7d115bb4-21f2-4c70-af08-1cc066aeb033",
  linking: "01f82bae-761b-47bd-9c61-641892cc0279",
};
const DEFINITION_ID = "25593b3b-f2b8-4304-bba2-e6eb6e3f4872";

export const CONFIG = {
  items: [
    {
      id: DEFINITION_ID,
      kind: 0,
      name: "Dataset Onboarding",
      steps: [
        { id: STEP.onboarding, order: 0, kind: 0 },
        { id: STEP.profiling, order: 1, kind: 1 },
        { id: STEP.linking, order: 2, kind: 2 },
      ],
    },
  ],
};

const snapshot = (status, stepStatuses) => ({
  id: PROCESS_ID,
  processId: DEFINITION_ID,
  status,
  dataset: { id: DATASET_ID },
  steps: [STEP.onboarding, STEP.profiling, STEP.linking].map((stepId, i) => ({
    id: `9a0b1c2d-3e4f-5a6b-7c8d-00000000000${i + 1}`,
    stepId,
    status: stepStatuses[i],
  })),
});

/** Process status codes: 0 InProgress, 1 Failed, 2 Succeeded, 3 Pending. */
export const RUNNING = snapshot(0, [2, 0, 3]);
export const SUCCEEDED = snapshot(2, [2, 2, 2]);

export const FIELDS_OF_SCIENCE = {
  hierarchy: [
    {
      ordinal: 1,
      code: "1",
      name: "NATURAL SCIENCES",
      children: [
        {
          ordinal: 1,
          code: "1.5",
          name: "EARTH AND RELATED ENVIRONMENTAL SCIENCES",
        },
      ],
    },
  ],
};

export const LICENSES = [
  { code: "cc-by-4.0", name: "CC BY 4.0", description: "Attribution 4.0." },
];

/**
 * Long names with no break opportunity: underscores and dots do not wrap, so
 * each is one unbroken run far wider than a 390px row.
 */
export const LONG_FILE = {
  ...FILE,
  name: "synthetic_sensor_network_hourly_readings_2026_pilot_region_extended_export_final_version.csv",
};
export const LONG_FAILING_FILE = {
  ...FILE,
  name: "synthetic_sensor_network_minute_readings_2026_pilot_region_extended_export_with_gaps.csv",
};
