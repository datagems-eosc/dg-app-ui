"use client";

import React from "react";
import { Input } from "../Input";
import { Textarea } from "../Textarea";

interface AdditionalInformationData {
  referenceString: string;
  sourceLink: string;
}

interface AdditionalInformationProps {
  data: AdditionalInformationData;
  onChange: (data: AdditionalInformationData) => void;
  errors: {
    referenceString?: string;
    sourceLink?: string;
  };
}

export function AdditionalInformation({ data, onChange, errors }: AdditionalInformationProps) {
  const handleFieldChange = (field: keyof AdditionalInformationData, value: string) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Textarea
          label="Reference String"
          value={data.referenceString}
          onChange={(e) => handleFieldChange("referenceString", e.target.value)}
          placeholder="How should this dataset be cited?"
          rows={4}
          error={errors.referenceString}
          maxLength={3000}
        />
        <div className="mt-1 text-xs text-slate-400 text-right">
          {data.referenceString.length}/3000
        </div>
      </div>

      <Input
        label="Dataset Source Link"
        value={data.sourceLink}
        onChange={(e) => handleFieldChange("sourceLink", e.target.value)}
        placeholder="https://..."
        error={errors.sourceLink}
        type="url"
      />
    </div>
  );
}
