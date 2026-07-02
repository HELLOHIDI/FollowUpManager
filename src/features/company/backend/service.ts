import type { SupabaseClient } from "@supabase/supabase-js";
import { failure, success, type HandlerResult } from "@/backend/http/response";
import type { MutationClientFactory } from "@/backend/supabase/client";
import {
  CompanyResponseSchema,
  CompanyRowSchema,
  type CompanyInput,
  type CompanyResponse,
  type CompanyRow,
} from "./schema";
import {
  companyErrorCodes,
  type CompanyServiceError,
} from "./error";
import type { Database } from "@/lib/supabase/types";

const COMPANY_TABLE = "companies";
const COMPANY_SELECT =
  "id, company_name, business_type, company_size, business_registration_number, corporate_registration_number, founded_at, profile_status, created_at, updated_at, deleted_at";
const BUSINESS_REGISTRATION_UNIQUE_CONSTRAINT =
  "companies_business_registration_number_key";

type CompanyResult = HandlerResult<
  CompanyResponse,
  CompanyServiceError,
  unknown
>;
type CompanyListResult = HandlerResult<
  CompanyResponse[],
  CompanyServiceError,
  unknown
>;

const mapCompanyRow = (row: unknown, status: 200 | 201 = 200): CompanyResult => {
  const parsedRow = CompanyRowSchema.safeParse(row);

  if (!parsedRow.success) {
    return failure(
      500,
      companyErrorCodes.responseInvalid,
      "저장된 기업 정보가 올바르지 않습니다."
    );
  }

  const company = {
    businessRegistrationNumber: parsedRow.data.business_registration_number,
    businessType: parsedRow.data.business_type,
    companyName: parsedRow.data.company_name,
    companySize: parsedRow.data.company_size,
    corporateRegistrationNumber:
      parsedRow.data.corporate_registration_number,
    createdAt: parsedRow.data.created_at,
    foundedAt: parsedRow.data.founded_at,
    id: parsedRow.data.id,
    profileStatus: parsedRow.data.profile_status,
    updatedAt: parsedRow.data.updated_at,
  } satisfies CompanyResponse;
  const parsedResponse = CompanyResponseSchema.safeParse(company);

  return parsedResponse.success
    ? success(parsedResponse.data, status)
    : failure(
        500,
        companyErrorCodes.responseInvalid,
        "기업 응답을 생성하지 못했습니다."
      );
};

const mapWriteError = (error: { code?: string; message?: string }) => {
  if (
    error.code === "23505" &&
    error.message?.includes(BUSINESS_REGISTRATION_UNIQUE_CONSTRAINT)
  ) {
    return failure(
      409,
      companyErrorCodes.registrationNumberConflict,
      "이미 등록된 사업자등록번호입니다."
    );
  }

  return failure(
    500,
    companyErrorCodes.writeError,
    "기업 정보를 저장하지 못했습니다."
  );
};

const toWritePayload = (input: CompanyInput) => ({
  business_registration_number: input.businessRegistrationNumber,
  business_type: input.businessType,
  company_name: input.companyName,
  company_size: input.companySize,
  corporate_registration_number:
    input.businessType === "corporation"
      ? input.corporateRegistrationNumber
      : null,
  founded_at: input.foundedAt,
  profile_status:
    input.companySize === "unknown" ? "review_required" : "complete",
} satisfies Database["public"]["Tables"]["companies"]["Insert"]);

export const listCompanies = async (
  client: SupabaseClient<Database>
): Promise<CompanyListResult> => {
  const { data, error } = await client
    .from(COMPANY_TABLE)
    .select(COMPANY_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return failure(
      500,
      companyErrorCodes.fetchError,
      "기업 목록을 불러오지 못했습니다."
    );
  }

  const companies: CompanyResponse[] = [];

  for (const row of data ?? []) {
    const mapped = mapCompanyRow(row);

    if (mapped.ok === false) {
      return failure(
        mapped.status,
        mapped.error.code,
        mapped.error.message,
        mapped.error.details
      );
    }

    companies.push(mapped.data);
  }

  return success(companies);
};

export const getCompany = async (
  client: SupabaseClient<Database>,
  companyId: string
): Promise<CompanyResult> => {
  const { data, error } = await client
    .from(COMPANY_TABLE)
    .select(COMPANY_SELECT)
    .eq("id", companyId)
    .is("deleted_at", null)
    .maybeSingle<CompanyRow>();

  if (error) {
    return failure(
      500,
      companyErrorCodes.fetchError,
      "기업 정보를 불러오지 못했습니다."
    );
  }

  return data
    ? mapCompanyRow(data)
    : failure(404, companyErrorCodes.notFound, "기업을 찾을 수 없습니다.");
};

export const createCompany = async (
  createClient: MutationClientFactory,
  input: CompanyInput
): Promise<CompanyResult> => {
  const client = createClient();
  const { data, error } = await client
    .from(COMPANY_TABLE)
    .insert(toWritePayload(input))
    .select(COMPANY_SELECT)
    .single<CompanyRow>();

  if (error) {
    return mapWriteError(error);
  }

  return mapCompanyRow(data, 201);
};

export const updateCompany = async (
  createClient: MutationClientFactory,
  companyId: string,
  input: CompanyInput
): Promise<CompanyResult> => {
  const client = createClient();
  const { data, error } = await client
    .from(COMPANY_TABLE)
    .update(toWritePayload(input))
    .eq("id", companyId)
    .is("deleted_at", null)
    .select(COMPANY_SELECT)
    .maybeSingle<CompanyRow>();

  if (error) {
    return mapWriteError(error);
  }

  return data
    ? mapCompanyRow(data)
    : failure(404, companyErrorCodes.notFound, "기업을 찾을 수 없습니다.");
};
