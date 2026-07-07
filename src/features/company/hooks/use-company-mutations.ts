"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCompanyRequest,
  deleteCompanyRequest,
  updateCompanyRequest,
} from "../api";
import type { CompanyResponse } from "../lib/dto";
import { companyKeys } from "./company-keys";

const replaceCompany = (
  companies: CompanyResponse[] | undefined,
  company: CompanyResponse
) => {
  if (!companies) {
    return [company];
  }

  const exists = companies.some(({ id }) => id === company.id);

  return exists
    ? companies.map((current) =>
        current.id === company.id ? company : current
      )
    : [...companies, company];
};

export const useCompanyMutations = () => {
  const queryClient = useQueryClient();

  const applyAuthoritativeCompany = (company: CompanyResponse) => {
    queryClient.setQueryData(companyKeys.detail(company.id), company);
    queryClient.setQueryData<CompanyResponse[]>(
      companyKeys.list(),
      (companies) => replaceCompany(companies, company)
    );
    void queryClient.invalidateQueries({ queryKey: companyKeys.lists() });
  };

  const createMutation = useMutation({
    mutationFn: createCompanyRequest,
    onSuccess: applyAuthoritativeCompany,
  });
  const updateMutation = useMutation({
    mutationFn: updateCompanyRequest,
    onSuccess: applyAuthoritativeCompany,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCompanyRequest,
    onSuccess: (_, companyId) => {
      queryClient.removeQueries({ queryKey: companyKeys.detail(companyId) });
      queryClient.setQueryData<CompanyResponse[]>(
        companyKeys.list(),
        (companies) => companies?.filter(({ id }) => id !== companyId) ?? []
      );
      void queryClient.invalidateQueries({ queryKey: companyKeys.lists() });
    },
  });

  return { createMutation, deleteMutation, updateMutation };
};
