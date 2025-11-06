"use client";

import { User } from "lucide-react";
import type React from "react";

interface AvatarProps {
  src?: string | null;
  name?: string;
  email?: string;
  size?: "sm" | "smPlus" | "md" | "lg" | "lPlus" | "xl";
  className?: string;
  isLoading?: boolean;
}

const sizeClasses = {
  sm: "w-8 h-8 text-descriptions-12-regular",
  smPlus: "w-9 h-9 text-body-16-regular",
  md: "w-10 h-10 sm:w-12 sm:h-12 text-body-16-regular",
  lg: "w-14 h-14 sm:w-16 sm:h-16 text-body-16-regular",
  lPlus: "w-18 h-18 sm:w-20 sm:h-20 text-H2-32-regular",
  xl: "w-20 h-20 sm:w-24 sm:h-24 text-H6-18-semibold",
};

function getInitials(name?: string, email?: string): string {
  if (name && name.trim().length > 0) {
    const names = name
      .trim()
      .split(" ")
      .filter((n) => n.length > 0);
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    if (names.length === 1) {
      return names[0][0].toUpperCase();
    }
  }

  if (email && email.trim().length > 0) {
    return email.trim()[0].toUpperCase();
  }

  return "MJ"; // Fallback dla Marry Johnson
}

function getAvatarColor(name?: string, email?: string): string {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-yellow-500",
    "bg-red-500",
    "bg-teal-500",
  ];

  // Use email as the primary stable key so color doesn't change when editing name
  const str = email?.trim() || name?.trim() || "Marry Johnson";
  const hash = str.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function Avatar({
  src,
  name,
  email,
  size = "md",
  className = "",
  isLoading = false,
}: AvatarProps) {
  const initials = getInitials(name, email);
  const bgColor = getAvatarColor(name, email);
  const sizeClass = sizeClasses[size];

  const isEmptyIdentity = (!src || src === undefined) && !name && !email;

  if (isLoading || isEmptyIdentity) {
    return (
      <div
        className={`${sizeClass} rounded-full overflow-hidden shrink-0 bg-gray-200 animate-pulse ${className}`}
      />
    );
  }

  // Only show image if we have a valid data URL (starts with data:image)
  const hasValidImage = src?.startsWith("data:image");

  if (hasValidImage) {
    return (
      <div
        className={`${sizeClass} rounded-full overflow-hidden shrink-0 ${className}`}
      >
        <img
          src={src || ""}
          alt={name || email || "Profile picture"}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center text-white ${bgColor} shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
}

interface AvatarUploadProps {
  currentSrc?: string | null;
  name?: string;
  email?: string;
  onImageSelect: (file: File) => void;
  size?: "sm" | "smPlus" | "md" | "lg" | "xl";
  disabled?: boolean;
  isLoading?: boolean;
}

export function AvatarUpload({
  currentSrc,
  name,
  email,
  onImageSelect,
  size = "lg",
  disabled = false,
  isLoading = false,
}: AvatarUploadProps) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Basic validation
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        alert("Image size should be less than 5MB");
        return;
      }

      onImageSelect(file);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      const input = document.getElementById(
        "avatar-upload",
      ) as HTMLInputElement;
      input?.click();
    }
  };

  return (
    <div className="relative inline-block">
      <div
        onClick={handleClick}
        className={`relative ${disabled ? "" : "cursor-pointer group"}`}
      >
        <Avatar
          src={currentSrc}
          name={name}
          email={email}
          size={size}
          isLoading={isLoading}
        />

        {!disabled && (
          <div className="absolute inset-0 rounded-full transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:bg-black group-hover:bg-opacity-50">
            <div className="text-center">
              <User className="w-4 h-4 text-white mx-auto mb-1" />
              <div className="text-descriptions-12-semibold text-white">
                Upload
              </div>
            </div>
          </div>
        )}
      </div>

      {!disabled && (
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="avatar-upload"
        />
      )}
    </div>
  );
}
