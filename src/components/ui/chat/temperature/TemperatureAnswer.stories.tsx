import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  athensDaySql,
  athensDayTable,
  athensTimeSql,
  zurichSingleSql,
  zurichSingleTable,
} from "@/lib/temperatureAnswer/fixtures/observed";
import {
  allNullTable,
  extraColumnTable,
  leapYearTable,
  missingValuesTable,
} from "@/lib/temperatureAnswer/fixtures/synthetic";
import {
  type TemperatureAnswer as Interpreted,
  interpretTemperatureAnswer,
} from "@/lib/temperatureAnswer/interpret";
import type { TableData } from "@/types/chat";
import { TemperatureAnswer } from "./TemperatureAnswer";

const props = (tableData: TableData, sqlQuery?: string) => ({
  answer: interpretTemperatureAnswer(tableData) as Interpreted,
  message: { tableData, sqlQuery },
});

const meta: Meta<typeof TemperatureAnswer> = {
  title: "Chat/TemperatureAnswer",
  component: TemperatureAnswer,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof TemperatureAnswer>;

/** The observed Athens daily answer: chart first, map last. */
export const Normal: Story = { args: props(athensDayTable, athensDaySql) };

/** Synthetic: 366 days, no point markers, month labels. */
export const LongSeries: Story = { args: props(leapYearTable, athensDaySql) };

/** Synthetic: gaps for missing values and a date that can't be read. */
export const MissingValues: Story = {
  args: props(missingValuesTable, athensDaySql),
};

/** The observed Zurich answer: one value, no time column. */
export const SingleValue: Story = {
  args: props(zurichSingleTable, zurichSingleSql),
};

/** Synthetic: rows came back without any temperature. */
export const NoValues: Story = { args: props(allNullTable, athensDaySql) };

/** No supported coordinate pair in the SQL: no map. */
export const NoLocation: Story = { args: props(athensDayTable, "SELECT 1") };

/** Synthetic: timestamps in UTC and an extra column (see the Table view). */
export const ExtraColumns: Story = {
  args: props(extraColumnTable, athensTimeSql),
};
