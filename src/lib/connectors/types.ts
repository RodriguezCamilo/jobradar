import type { NormalizedJob, Source } from "../domain";
export interface ConnectorResult {
  jobs: NormalizedJob[];
  received: number;
  errors: string[];
  warnings: string[];
  complete: boolean;
  retryAt?: string;
}
export interface JobConnector {
  source: Source;
  fetchJobs(): Promise<ConnectorResult>;
}
// Greenhouse, Lever and Ashby adapters will require configured boards/companies.
// There is deliberately no assumed global ATS search endpoint.
