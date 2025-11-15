export interface CronhostConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface Schedule {
  id: string;
  name: string;
  description?: string;
  cronExpression: string;
  timezone: string;
  endpoint: string;
  httpMethod: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: string;
  headers?: string;
  isEnabled: boolean;
  nextRunAtUtc: Date;
  lastRunAtUtc?: Date;
  createdAt: Date;
  updatedAt: Date;
  maxRetries: number;
  timeoutSeconds: number;
}

export interface Job {
  id: string;
  scheduleId: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  scheduledRunAtUtc: Date;
  attemptNumber: number;
  httpMethod: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  endpoint: string;
  body?: string;
  headers?: string;
  statusCode?: number;
  response?: string;
  startedAtUtc?: Date;
  completedAtUtc?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduleData {
  name: string;
  description?: string;
  cronExpression: string;
  timezone: string;
  endpoint: string;
  httpMethod: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: string;
  headers?: Record<string, string>;
  maxRetries?: number;
  timeoutSeconds?: number;
}

export interface UpdateScheduleData {
  name?: string;
  description?: string;
  cronExpression?: string;
  timezone?: string;
  endpoint?: string;
  httpMethod?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: string;
  headers?: Record<string, string>;
  maxRetries?: number;
  timeoutSeconds?: number;
}

export interface GetJobsParams {
  scheduleId?: string;
  status?: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  page?: number;
  limit?: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface BulkCreateResponse {
  count: number;
  schedules: {
    id: string;
    name: string;
  }[];
}

export interface BulkValidationError {
  index: number;
  schedule: CreateScheduleData;
  error: string;
}

export interface ApiError {
  error: {
    message: string;
    code: string;
    details?: any;
    index?: number;
  };
}

export class Cronhost {
  private config: CronhostConfig;
  private baseUrl: string;

  constructor(config: CronhostConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl ?? "https://cronho.st";
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          ...options.headers,
        },
      });

      // Check content type to determine how to parse the response
      const contentType = response.headers.get("content-type");
      const isJson = contentType?.includes("application/json");

      let data: any;
      let responseText = "";

      try {
        if (isJson) {
          data = await response.json();
        } else {
          responseText = await response.text();
          // Try to parse as JSON anyway in case content-type is wrong
          try {
            data = JSON.parse(responseText);
          } catch {
            data = { error: { message: responseText } };
          }
        }
      } catch (parseError) {
        const err = parseError as Error;
        throw new Error(`Failed to parse response: ${err.message}`);
      }

      if (!response.ok) {
        // Enhanced error message with more context
        const errorMessage =
          data?.error?.message ||
          data?.message ||
          responseText ||
          `HTTP ${response.status}: ${response.statusText}`;

        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          url: url,
          message: errorMessage,
          ...(data?.error && { error: data.error }),
        };

        throw new Error(`API request failed: ${errorMessage}`, {
          cause: errorDetails,
        });
      }

      return data;
    } catch (error) {
      const err = error as Error;
      // If it's already our custom error, re-throw it
      if (
        err.message?.startsWith("API request failed:") ||
        err.message?.startsWith("Failed to parse response:")
      ) {
        throw err;
      }

      // Handle network errors and other fetch failures
      throw new Error(`Network error: ${err.message}`, { cause: err });
    }
  }

  // Schedule methods
  async getSchedules(): Promise<Schedule[]> {
    const response = await this.request<ApiResponse<Schedule[]>>("/schedules");
    return response.data;
  }

  async getSchedule(id: string): Promise<Schedule> {
    const response = await this.request<ApiResponse<Schedule>>(
      `/schedules/${id}`
    );
    return response.data;
  }

  async createSchedule(data: CreateScheduleData): Promise<Schedule>;
  async createSchedule(data: CreateScheduleData[]): Promise<BulkCreateResponse>;
  async createSchedule(
    data: CreateScheduleData | CreateScheduleData[]
  ): Promise<Schedule | BulkCreateResponse> {
    const isBulk = Array.isArray(data);

    if (isBulk) {
      // Bulk creation
      if (data.length === 0) {
        throw new Error("At least one schedule is required for bulk creation");
      }
      if (data.length > 1000) {
        throw new Error("Cannot create more than 1000 schedules at once");
      }

      const requestData = data.map((schedule) => ({
        ...schedule,
        headers: schedule.headers
          ? JSON.stringify(schedule.headers)
          : undefined,
      }));

      const response = await this.request<ApiResponse<BulkCreateResponse>>(
        "/schedules/bulk",
        {
          method: "POST",
          body: JSON.stringify(requestData),
        }
      );
      return response.data;
    } else {
      // Single schedule creation
      const requestData = {
        ...data,
        headers: data.headers ? JSON.stringify(data.headers) : undefined,
      };

      const response = await this.request<ApiResponse<Schedule>>("/schedules", {
        method: "POST",
        body: JSON.stringify(requestData),
      });
      return response.data;
    }
  }

  async updateSchedule(
    id: string,
    data: UpdateScheduleData
  ): Promise<Schedule> {
    const requestData = {
      ...data,
      headers: data.headers ? JSON.stringify(data.headers) : undefined,
    };

    const response = await this.request<ApiResponse<Schedule>>(
      `/schedules/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(requestData),
      }
    );
    return response.data;
  }

  async deleteSchedule(id: string): Promise<void> {
    await this.request(`/schedules/${id}`, {
      method: "DELETE",
    });
  }

  async triggerSchedule(id: string): Promise<Job> {
    const response = await this.request<ApiResponse<Job>>(
      `/schedules/${id}/trigger`,
      {
        method: "POST",
      }
    );
    return response.data;
  }

  async toggleSchedule(id: string, enabled: boolean): Promise<Schedule> {
    const response = await this.request<ApiResponse<Schedule>>(
      `/schedules/${id}/toggle`,
      {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }
    );
    return response.data;
  }

  // Job methods
  async getJobs(params: GetJobsParams = {}): Promise<Job[]> {
    const searchParams = new URLSearchParams();

    if (params.scheduleId) searchParams.set("scheduleId", params.scheduleId);
    if (params.status) searchParams.set("status", params.status);
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/jobs?${queryString}` : "/jobs";

    const response = await this.request<ApiResponse<Job[]>>(endpoint);
    return response.data;
  }

  async getJob(id: string): Promise<Job> {
    const response = await this.request<ApiResponse<Job>>(`/jobs/${id}`);
    return response.data;
  }
}

export default Cronhost;
