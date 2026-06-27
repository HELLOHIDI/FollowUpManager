export {
  CompanyInputSchema,
  CompanyListResponseSchema,
  CompanyResponseSchema,
  type CompanyInput,
  type CompanyResponse,
} from "@/features/company/backend/schema";

export const formatBusinessRegistrationNumber = (value: string) =>
  value.replace(/^([0-9]{3})([0-9]{2})([0-9]{5})$/, "$1-$2-$3");
