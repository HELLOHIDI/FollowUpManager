"use client";

import { apiClient } from "@/lib/remote/api-client";
import {
  CompanyListResponseSchema,
  CompanyResponseSchema,
  type CompanyInput,
  type CompanyResponse,
} from "./lib/dto";

export const fetchCompanies = async () => {
  const { data } = await apiClient.get("/api/companies");
  return CompanyListResponseSchema.parse(data);
};

export const createCompanyRequest = async (input: CompanyInput) => {
  const { data } = await apiClient.post("/api/companies", input);
  return CompanyResponseSchema.parse(data);
};

export const updateCompanyRequest = async ({
  companyId,
  input,
}: {
  companyId: string;
  input: CompanyInput;
}): Promise<CompanyResponse> => {
  const { data } = await apiClient.patch(`/api/companies/${companyId}`, input);
  return CompanyResponseSchema.parse(data);
};
