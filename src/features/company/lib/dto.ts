export {
  COMPANY_ACCOUNT_MANAGERS,
  CompanyInputSchema,
  CompanyListResponseSchema,
  CompanyResponseSchema,
  type CompanyInput,
  type CompanyResponse,
} from "@/features/company/backend/schema";

export const COMPANY_ACCOUNT_MANAGER_OPTIONS = [
  { name: "정현정", role: "팀장", team: "사업기획 1팀" },
  { name: "허진석", role: "팀장", team: "사업기획 2팀" },
  { name: "이영준", role: "팀원", team: "사업기획 2팀" },
  { name: "주재형", role: "팀원", team: "사업기획 2팀" },
  { name: "박종열", role: "팀원", team: "사업기획 1팀" },
  { name: "이정준", role: "팀원", team: "사업기획 2팀" },
  { name: "류희재", role: "팀원", team: "사업기획 1팀" },
] as const;

export const formatBusinessRegistrationNumber = (value: string) =>
  value.replace(/^([0-9]{3})([0-9]{2})([0-9]{5})$/, "$1-$2-$3");

export const formatCorporateRegistrationNumber = (value: string) =>
  value.replace(/^([0-9]{6})([0-9]{7})$/, "$1-$2");
