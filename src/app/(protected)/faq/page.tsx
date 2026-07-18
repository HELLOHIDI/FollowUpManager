import { EmptyPanel, PageHeading } from "@/components/product-shell";

export default function FaqPage() {
  return (
    <>
      <PageHeading
        eyebrow="도움말"
        title="자주 묻는 질문"
        description="업무 중 자주 확인하는 안내를 모아둡니다."
      />
      <EmptyPanel
        title="FAQ를 준비 중입니다"
        description="안내 문서가 등록되면 여기에서 바로 확인할 수 있습니다."
      />
    </>
  );
}
