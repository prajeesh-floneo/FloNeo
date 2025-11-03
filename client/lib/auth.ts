// Authentication utilities for FloNeo platform
export interface User {
  id: number;
  email: string;
  role: string;
  verified: boolean;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    accessToken: string;
  };
}

// Get stored auth token
export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("authToken");
};

// Set auth token
export const setAuthToken = (token: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem("authToken", token);
};

// Remove auth token
export const removeAuthToken = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("authToken");
};

// Check if token is about to expire (within 5 minutes)
export const isTokenExpiringSoon = (): boolean => {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));
    const now = Date.now() / 1000;
    const expiresIn = payload.exp - now;

    // Return true if token expires in less than 5 minutes
    return expiresIn < 5 * 60;
  } catch {
    return false;
  }
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  const token = getAuthToken();
  if (!token) return false;

  try {
    // Basic JWT structure check
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    // Check if token is expired (basic check)
    const payload = JSON.parse(atob(parts[1]));
    const now = Date.now() / 1000;

    return payload.exp > now;
  } catch {
    return false;
  }
};

// Get user info from token
export const getUserFromToken = (): User | null => {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      verified: true, // Developers are pre-verified
    };
  } catch {
    return null;
  }
};

// Refresh access token
export const refreshAccessToken = async (): Promise<boolean> => {
  const token = getAuthToken();
  if (!token) return false;

  try {
    console.log("🔄 AUTH: Attempting to refresh token");
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (data.success && data.data?.accessToken) {
      console.log("✅ AUTH: Token refreshed successfully");
      setAuthToken(data.data.accessToken);
      return true;
    } else {
      console.error("❌ AUTH: Token refresh failed:", data.message);
      return false;
    }
  } catch (error) {
    console.error("❌ AUTH: Token refresh error:", error);
    return false;
  }
};

// Enhanced authenticated fetch with automatic error handling
export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  // Check if token is expiring soon and refresh if needed
  if (isTokenExpiringSoon()) {
    console.log("⏰ AUTH: Token expiring soon, attempting refresh");
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      console.warn(
        "⚠️ AUTH: Token refresh failed, proceeding with current token"
      );
    }
  }

  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle authentication errors automatically
  if (response.status === 401) {
    console.log("🔒 AUTH: 401 Unauthorized - redirecting to login");
    removeAuthToken();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
    throw new Error("Authentication failed - redirecting to login");
  }

  return response;
};

// Enhanced error handling for API responses
export const handleApiError = async (response: Response): Promise<any> => {
  if (!response.ok) {
    let errorMessage = "An error occurred";
    let errorCode = "UNKNOWN_ERROR";

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
      errorCode = errorData.error?.code || errorCode;
    } catch {
      // If response is not JSON, use status text
      errorMessage = response.statusText || `HTTP ${response.status}`;
    }

    // Handle specific error codes
    switch (response.status) {
      case 401:
        console.log("🔒 AUTH: Authentication failed - redirecting to login");
        removeAuthToken();
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
        throw new Error("Authentication failed - please login again");

      case 403:
        throw new Error("Access denied - insufficient permissions");

      case 404:
        throw new Error("Resource not found");

      case 429:
        throw new Error("Too many requests - please try again later");

      case 500:
        throw new Error("Server error - please try again later");

      default:
        throw new Error(errorMessage);
    }
  }

  return response.json();
};

// Upload file with authentication
export const uploadFile = async (file: File, appId?: number): Promise<any> => {
  const token = getAuthToken();

  if (!token) {
    throw new Error("No authentication token");
  }

  // Check file size (50MB limit)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    throw new Error(
      `File size exceeds 50MB limit. File size: ${(
        file.size /
        1024 /
        1024
      ).toFixed(2)}MB`
    );
  }

  const formData = new FormData();
  formData.append("files", file); // Use 'files' to match backend expectation
  if (appId) {
    formData.append("appId", appId.toString());
  }

  const response = await fetch("/api/media/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || "Upload failed");
  }

  return data.data;
};

// Check authentication and redirect if needed
export const requireAuthentication = (): boolean => {
  if (!isAuthenticated()) {
    console.log("🔒 AUTH: Authentication required - redirecting to login");
    removeAuthToken();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
    return false;
  }
  return true;
};

// Enhanced authentication check with token validation
export const validateAndRefreshAuth = async (): Promise<boolean> => {
  // First check if we have a token
  if (!getAuthToken()) {
    console.log("🔒 AUTH: No token found - redirecting to login");
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
    return false;
  }

  // Check if token is valid
  if (!isAuthenticated()) {
    console.log("🔒 AUTH: Token expired - redirecting to login");
    removeAuthToken();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
    return false;
  }

  // Try to refresh if expiring soon
  if (isTokenExpiringSoon()) {
    console.log("⏰ AUTH: Token expiring soon - attempting refresh");
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      console.log("🔒 AUTH: Token refresh failed - redirecting to login");
      removeAuthToken();
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
      return false;
    }
  }

  return true;
};

// Logout user
export const logout = async (): Promise<void> => {
  const token = getAuthToken();

  if (token) {
    try {
      // Call backend logout endpoint
      await authenticatedFetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  removeAuthToken();

  // Redirect to login
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
};
