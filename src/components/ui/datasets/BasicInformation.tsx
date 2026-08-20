"use client";

import { Input } from "../Input";
import { MarkdownEditor } from "../MarkdownEditor";
import { KeywordInput } from "./KeywordInput";

interface BasicInformationData {
  title: string;
  headline: string;
  description: string;
  keywords: string[];
}

interface BasicInformationProps {
  data: BasicInformationData;
  onChange: (data: BasicInformationData) => void;
  errors: {
    title?: string;
    headline?: string;
    description?: string;
    keywords?: string;
  };
}

export function BasicInformation({
  data,
  onChange,
  errors,
}: BasicInformationProps) {
  const handleFieldChange = (field: keyof BasicInformationData, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Input
        label="Title"
        required
        value={data.title}
        onChange={(e) => handleFieldChange("title", e.target.value)}
        placeholder="Enter dataset title"
        error={errors.title}
      />

      <div>
        <Input
          label="Headline"
          required
          value={data.headline}
          onChange={(e) => handleFieldChange("headline", e.target.value)}
          placeholder="Enter short headline"
          error={errors.headline}
          maxLength={150}
        />
        <div className="mt-1 text-xs text-gray-650 text-right">
          {data.headline.length}/150
        </div>
      </div>

      <MarkdownEditor
        label="Description"
        required
        value={data.description}
        onChange={(value) => handleFieldChange("description", value)}
        placeholder="Provide a detailed description of the dataset contents"
        error={errors.description}
        maxLength={3000}
      />

      <KeywordInput
        label="Keywords"
        value={data.keywords}
        onChange={(keywords) => handleFieldChange("keywords", keywords)}
        placeholder="Separate with commas e.g. encyclopedia, historical texts, knowledge graph"
        error={errors.keywords}
        required={true}
        maxLength={250}
      />
    </div>
  );
}
