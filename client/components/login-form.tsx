"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAuthToken, handleApiError } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { designSystem } from "@/lib/design-system";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(""); // Clear previous errors

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      console.log("🔐 LOGIN: Response received:", {
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        // Use enhanced error handling
        try {
          await handleApiError(response);
        } catch (apiError: any) {
          setError(apiError.message || "Login failed");
          return;
        }
      }

      const data = await response.json();

      if (data.success) {
        // Store the JWT token using auth utility
        console.log(
          "✅ LOGIN: Storing access token:",
          data.data.accessToken.substring(0, 20) + "..."
        );
        setAuthToken(data.data.accessToken);

        // Verify token was stored
        const storedToken = localStorage.getItem("authToken");
        console.log(
          "✅ LOGIN: Token stored successfully:",
          storedToken ? "YES" : "NO"
        );

        router.push("/dashboard");
      } else {
        console.error("❌ LOGIN: Login failed:", data.message);
        setError(data.message || "Invalid credentials");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      setError(
        error.message ||
          "Network error. Please check your connection and try again."
      );
    }

    setIsLoading(false);
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden font-poppins"
      style={{
        backgroundColor: designSystem.colors.background.primary,
        fontFamily: "var(--font-poppins), Poppins, sans-serif",
      }}
    >
      <div className="absolute inset-0">
        <div
          className="absolute -top-40 -left-32 w-[600px] h-[500px] transform rotate-12 opacity-80"
          style={{
            background: "linear-gradient(135deg, #0066FF 0%, #4A90E2 100%)",
            borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%",
            filter: "blur(1px)",
          }}
        />

        <div
          className="absolute -top-20 right-0 w-[400px] h-[600px] transform -rotate-12 opacity-75"
          style={{
            background: "linear-gradient(135deg, #2ECC71 0%, #27AE60 100%)",
            borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
            filter: "blur(1px)",
          }}
        />

        <div
          className="absolute -bottom-32 right-0 w-[500px] h-[400px] transform rotate-45 opacity-70"
          style={{
            background: "linear-gradient(135deg, #FFC107 0%, #F39C12 100%)",
            borderRadius: "50% 50% 80% 20% / 60% 40% 60% 40%",
            filter: "blur(1px)",
          }}
        />

        <div
          className="absolute -bottom-40 -left-20 w-[450px] h-[350px] transform -rotate-30 opacity-75"
          style={{
            background: "linear-gradient(135deg, #FF4FCB 0%, #E91E63 100%)",
            borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
            filter: "blur(1px)",
          }}
        />

        <div
          className="absolute top-1/4 left-1/3 w-[200px] h-[300px] transform rotate-45 opacity-40"
          style={{
            background: "linear-gradient(135deg, #0066FF 0%, #8E44AD 100%)",
            borderRadius: "60% 40% 40% 60% / 70% 30% 70% 30%",
            filter: "blur(2px)",
          }}
        />

        <div
          className="absolute bottom-1/4 right-1/3 w-[250px] h-[200px] transform -rotate-60 opacity-35"
          style={{
            background: "linear-gradient(135deg, #2ECC71 0%, #16A085 100%)",
            borderRadius: "80% 20% 60% 40% / 50% 50% 50% 50%",
            filter: "blur(2px)",
          }}
        />
      </div>

      <div className="relative z-10 min-h-screen flex">
        <div className="flex-1 flex items-center justify-center p-8">
          <div
            className="w-full max-w-lg h-[600px] border-2 border-dashed flex items-center justify-center"
            style={{
              backgroundColor: designSystem.colors.background.secondary,
              borderRadius: designSystem.spacing.borderRadius["2xl"],
              borderColor: designSystem.colors.border.secondary,
            }}
          >
            <div className="text-center space-y-4">
              <div
                className="w-24 h-24 mx-auto flex items-center justify-center"
                style={{
                  backgroundColor: designSystem.colors.background.secondary,
                  borderRadius: "50%",
                }}
              >
                <svg
                  className="w-12 h-12"
                  fill="none"
                  stroke={designSystem.colors.text.muted}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <p
                style={{
                  color: designSystem.colors.text.secondary,
                  fontWeight: designSystem.typography.fontWeight.medium,
                }}
              >
                Portrait Image
              </p>
              <p
                style={{
                  color: designSystem.colors.text.muted,
                  fontSize: designSystem.typography.fontSize.sm,
                }}
              >
                Placeholder for portrait
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <Card
            className="w-full max-w-sm p-8 relative overflow-hidden"
            style={{
              background: designSystem.components.glassCard.background,
              backdropFilter: designSystem.components.glassCard.backdropBlur,
              border: designSystem.components.glassCard.border,
              borderRadius: designSystem.components.glassCard.borderRadius,
              boxShadow: designSystem.components.glassCard.shadow,
            }}
          >
            <div
              className="absolute inset-0 rounded-[20px]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
                pointerEvents: "none",
              }}
            />

            <CardContent className="space-y-6 p-0 relative z-10">
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-3">
                  <Image
                    src="/floneo-logo.png"
                    alt="Floneo"
                    width={40}
                    height={40}
                  />
                </div>
                <h1
                  className="text-2xl font-bold tracking-tight"
                  style={{
                    color: designSystem.colors.text.primary,
                    fontWeight: designSystem.typography.fontWeight.bold,
                  }}
                >
                  floneo
                </h1>
              </div>

              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <h2
                    className="text-xl font-semibold"
                    style={{
                      color: designSystem.colors.text.primary,
                      fontWeight: designSystem.typography.fontWeight.semibold,
                    }}
                  >
                    Login
                  </h2>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: designSystem.colors.text.secondary }}
                  >
                    Enter your credentials to access your account
                  </p>
                </div>

                {error && (
                  <div
                    className="p-3 rounded-lg text-sm"
                    style={{
                      backgroundColor: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#dc2626",
                    }}
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="focus:ring-1 transition-all duration-200"
                    style={{
                      height: designSystem.components.input.height,
                      borderRadius: designSystem.components.input.borderRadius,
                      backgroundColor: "rgba(255, 255, 255, 0.8)",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      color: designSystem.colors.text.primary,
                      backdropFilter: "blur(10px)",
                    }}
                    required
                  />

                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="focus:ring-1 transition-all duration-200 pr-12"
                      style={{
                        height: designSystem.components.input.height,
                        borderRadius:
                          designSystem.components.input.borderRadius,
                        backgroundColor: "rgba(255, 255, 255, 0.8)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        color: designSystem.colors.text.primary,
                        backdropFilter: "blur(10px)",
                      }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full font-medium transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                    style={{
                      height: designSystem.components.button.primary.height,
                      backgroundColor:
                        designSystem.components.button.primary.background,
                      color: designSystem.components.button.primary.color,
                      borderRadius:
                        designSystem.components.button.primary.borderRadius,
                      boxShadow: "0 4px 15px rgba(255, 107, 53, 0.3)",
                    }}
                  >
                    {isLoading ? "Logging in..." : "Login"}
                  </Button>
                </form>

                <div
                  className="text-center text-xs leading-relaxed px-2"
                  style={{ color: designSystem.colors.text.muted }}
                >
                  By clicking continue, you agree to our{" "}
                  <span
                    style={{
                      color: designSystem.colors.text.primary,
                      fontWeight: designSystem.typography.fontWeight.medium,
                    }}
                  >
                    Terms of Service
                  </span>{" "}
                  and{" "}
                  <span
                    style={{
                      color: designSystem.colors.text.primary,
                      fontWeight: designSystem.typography.fontWeight.medium,
                    }}
                  >
                    Privacy Policy
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
