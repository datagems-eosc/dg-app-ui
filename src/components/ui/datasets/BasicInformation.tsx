"use client";

import React from "react";
import { Input } from "../Input";
import { Textarea } from "../Textarea";
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
    <div>
      <Input
        label="Title *"
        value={data.title}
        onChange={(e) => handleFieldChange("title", e.target.value)}
        placeholder="Enter dataset title"
        error={errors.title}
        className="mb-6"
      />

      <div>
        <Input
          label="Headline *"
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

      <div>
        <Textarea
          label="Description"
          value={data.description}
          onChange={(e) => handleFieldChange("description", e.target.value)}
          placeholder="Provide a detailed description of the dataset contents"
          rows={6}
          error={errors.description}
          maxLength={3000}
        />
        <div className="mt-1 text-xs text-gray-650 text-right">
          {data.description.length}/3000
        </div>
      </div>

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
