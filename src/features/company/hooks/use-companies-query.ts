"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCompanies, fetchCompany } from "../api";
import { companyKeys } from "./company-keys";

export const useCompaniesQuery = () =>
  useQuery({
    queryKey: companyKeys.list(),
    queryFn: fetchCompanies,
  });

export const useCompanyQuery = (companyId: string | null, enabled: boolean) =>
  useQuery({
    enabled: enabled && Boolean(companyId),
    queryFn: () => fetchCompany(companyId!),
    queryKey: companyKeys.detail(companyId ?? ""),
  });
