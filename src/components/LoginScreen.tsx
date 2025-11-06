"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "./ui/Button";

export default function LoginScreen() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg flex flex-col items-center">
        <div className="w-full mb-10">
          <img
            src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logo.svg`}
            alt="DataGEMS Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-center">
          Sign in to DataGEMS
        </h1>
        <p className="text-gray-600 mb-8 text-center">
          Discover, manage, and analyze datasets securely with DataGEMS.
        </p>
        <div className="w-full flex flex-col gap-4">
          {session ? (
            <Button
              className="w-full flex items-center justify-center gap-2 group bg-blue-700 hover:bg-blue-800 text-white"
              onClick={() => signOut()}
            >
              <span className="relative text-body-16-semibold text-white group-hover:text-blue-50 group-active:text-blue-100 flex items-center">
                Sign out ({session.user?.name || session.user?.email})
              </span>
            </Button>
          ) : (
            <Button
              className="w-full flex items-center justify-center gap-2 group bg-blue-700 hover:bg-blue-800 text-white"
              onClick={() => {
                signIn("keycloak");
              }}
              disabled={isLoading}
            >
              <span className="relative text-body-16-semibold text-white group-hover:text-blue-50 group-active:text-blue-100 flex items-center">
                {isLoading ? (
                  <svg
                    className="animate-spin h-5 w-5 mr-2 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    ></path>
                  </svg>
                ) : null}
                Sign in
              </span>
            </Button>
          )}
        </div>
        <div className="text-right mt-4 w-full">
          <small className="text-body-8-light text-gray-300">v1.0.5</small>
        </div>
      </div>
    </div>
  );
}
