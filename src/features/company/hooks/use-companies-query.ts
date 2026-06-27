"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCompanies } from "../api";
import { companyKeys } from "./company-keys";

export const useCompaniesQuery = () =>
  useQuery({
    queryKey: companyKeys.list(),
    queryFn: fetchCompanies,
  });
