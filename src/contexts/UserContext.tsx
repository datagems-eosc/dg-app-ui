"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";

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
  name: "",
  surname: "",
  email: "",
  profilePicture: undefined,
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userData, setUserData] = useState<UserData>(defaultUserData);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { data: session } = useSession();

  // Hydration-safe localStorage access
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      // Load profile picture from localStorage on mount
      const savedProfilePicture = localStorage.getItem("profilePicture");
      if (savedProfilePicture) {
        try {
          setUserData((prev) => ({
            ...prev,
            profilePicture: savedProfilePicture,
          }));
        } catch (error) {
          console.error(
            "Error reading profile picture from localStorage:",
            error
          );
        }
      }
    }
  }, [isMounted]);

  // Derive user info from NextAuth session (same logic as header)
  useEffect(() => {
    const fullName = session?.user?.name || "";
    const email = session?.user?.email || "";

    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    setUserData((prev) => ({
      ...prev,
      name: firstName,
      surname: lastName,
      email,
    }));
  }, [session?.user?.name, session?.user?.email]);

  const updateUserData = (data: Partial<UserData>) => {
    setUserData((prev) => ({ ...prev, ...data }));
  };

  const setProfilePicture = async (file: File | null): Promise<void> => {
    setIsLoading(true);

    try {
      if (!file) {
        // Remove profile picture
        updateUserData({ profilePicture: null });
        try {
          localStorage.removeItem("profilePicture");
        } catch (e) {
          // noop
        }
        return;
      }

      // Convert file to base64 data URL for storage
      const reader = new FileReader();

      return new Promise((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          updateUserData({ profilePicture: result });
          try {
            localStorage.setItem("profilePicture", result);
          } catch (e) {
            // noop
          }
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
