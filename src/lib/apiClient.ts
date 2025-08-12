import { getApiBaseUrl, fetchWithAuth } from "./utils";

/**
 * API Client for making direct calls to the DataGEMS API
 * This replaces the Next.js API route proxies
 */
class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  /**
   * Make an authenticated API request
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit = {},
    token?: string
  ): Promise<Response> {
    const url = `${this.baseUrl}/gw/api${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Merge headers properly
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return fetchWithAuth(url, {
      ...options,
      headers,
    });
  }

  /**
   * Dataset API methods
   */
  async queryDatasets(payload: any, token: string): Promise<any> {
    const response = await this.makeRequest(
      "/dataset/query",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch datasets");
    }

    return response.json();
  }

  /**
   * Collection API methods
   */
  async queryCollections(payload: any, token: string): Promise<any> {
    const response = await this.makeRequest(
      "/collection/query",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch collections");
    }

    return response.json();
  }

  /**
   * User Collections API methods
   */
  async queryUserCollections(payload: any, token: string): Promise<any> {
    const response = await this.makeRequest(
      "/user/collection/me/query",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch user collections");
    }

    return response.json();
  }

  /**
   * Search API methods
   */
  async searchInDataExplore(payload: any, token: string): Promise<any> {
    const response = await this.makeRequest(
      "/search/in-data-explore",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to search in data");
    }

    return response.json();
  }

  async searchCrossDataset(payload: any, token: string): Promise<any> {
    const response = await this.makeRequest(
      "/search/cross-dataset",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to search cross dataset");
    }

    return response.json();
  }

  /**
   * Conversation API methods
   */
  async getConversation(
    id: string,
    queryParams: string,
    token: string
  ): Promise<any> {
    const response = await this.makeRequest(
      `/conversation/${id}${queryParams}`,
      {
        method: "GET",
      },
      token
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch conversation");
    }

    return response.json();
  }

  async queryConversations(payload: any, token: string): Promise<any> {
    const response = await this.makeRequest(
      "/conversation/me/query",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch conversations");
    }

    return response.json();
  }

  async persistConversation(
    payload: any,
    queryParams: string,
    token: string
  ): Promise<any> {
    const response = await this.makeRequest(
      `/conversation/me/persist${queryParams}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to persist conversation");
    }

    return response.json();
  }

  async persistConversationDeep(
    payload: any,
    queryParams: string,
    token: string
  ): Promise<any> {
    const response = await this.makeRequest(
      `/conversation/me/persist/deep${queryParams}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to persist conversation deep");
    }

    return response.json();
  }

  async queryMessages(payload: any, token: string): Promise<any> {
    const response = await this.makeRequest(
      "/conversation/message/me/query",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch messages");
    }

    return response.json();
  }

  /**
   * Vocabulary API methods
   */
  async getFieldsOfScience(token: string): Promise<any> {
    const response = await this.makeRequest(
      "/vocabulary/fields-of-science",
      {
        method: "GET",
      },
      token
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch fields of science");
    }

    return response.json();
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
