"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getUserFromToken } from "@/lib/utils";

interface UserData {
  name: string;
  surname: string;
  email: string;
  profilePicture?: string | null;
}

interface UserContextType {
  userData: UserData;
  updateUserData: (data: Partial<UserData>) => void;
  setProfilePicture: (file: File | null) => Promise<void>;
  isLoading: boolean;
}

const defaultUserData: UserData = {
  name: "John",
  surname: "Doe",
  email: "john.doe@example.com",
  profilePicture: undefined,
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userData, setUserData] = useState<UserData>(defaultUserData);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Hydration-safe localStorage access
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      // Load user data from localStorage on mount
      const savedUserData = localStorage.getItem("userData");
      if (savedUserData) {
        try {
          const parsed = JSON.parse(savedUserData);
          setUserData((prev) => ({ ...prev, ...parsed }));
        } catch (error) {
          console.error("Error parsing user data from localStorage:", error);
        }
      }
    }
  }, [isMounted]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      const userInfo = getUserFromToken(token);
      if (userInfo) {
        // Split name into first and last name
        const nameParts = userInfo.name.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        setUserData({
          name: firstName,
          surname: lastName,
          email: userInfo.email,
          profilePicture: undefined,
        });
      }
    }
  }, []);

  const updateUserData = (data: Partial<UserData>) => {
    setUserData((prev) => ({ ...prev, ...data }));
  };

  const setProfilePicture = async (file: File | null): Promise<void> => {
    setIsLoading(true);

    try {
      if (!file) {
        // Remove profile picture
        updateUserData({ profilePicture: null });
        return;
      }

      // Convert file to base64 data URL for storage
      const reader = new FileReader();

      return new Promise((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          updateUserData({ profilePicture: result });
          resolve();
        };

        reader.onerror = () => {
          reject(new Error("Failed to read image file"));
        };

        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error("Error setting profile picture:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const contextValue: UserContextType = {
    userData,
    updateUserData,
    setProfilePicture,
    isLoading,
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
