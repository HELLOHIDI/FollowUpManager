# FuManager Domain Policies

이 디렉터리는 FuManager의 도메인별 정책 문서를 관리한다.
기능 구현 전 관련 정책 문서를 반드시 확인한다.

## Policy Index

- discord-weekly-briefing-policy.md
  - Discord 주간 브리핑의 기업-스레드-사업 메시지 계층과 발송 안전 규칙
  - 관련 기능: Discord 주간 브리핑, 담당자별 채널 설정

  - company-policy.md
    - 기업 등록, 기업 정보 필드, 기업 상태 계산, 사업자등록번호 정책
    - 관련 기능: 회사 설정, 온보딩, 기업 정보 카드, companies 테이블

  - project-policy.md
    - 사업 등록, 협약 기간, 총예산, 수행기관 정책
    - 관련 기능: 프로젝트 생성/수정, 프로젝트 스위처

  - budget-category-policy.md
    - 비목 정의, 비목별 증빙 요건, 사용 가능 범위, 유의사항
    - 관련 기능: 비목별 지출 목록, 지출 상세 정책 패널, 증빙 요건 안내

  - expense-execution-policy.md
    - 지출 4단계, 단계별 누적 입력, 소프트 게이트, 금액 검증, 변경 히스토리
    - 관련 기능: 지출 칸반, 지출 빠른 등록, 지출 상세 풀페이지

  - evidence-policy.md
    - 증빙 파일 종류, 업로드, 중복 감지, 필수/조건부/선택 증빙 상태
    - 관련 기능: 지출 상세 증빙 영역, 파일 업로드, Supabase Storage

  - github-deployment-policy.md
    - 모든 저장소 작업의 브랜치, 검증, 커밋, Push, Preview, PR 승인, Production 배포 정책
    - 관련 범위: GitHub 작업 컨벤션, GitHub Actions, Vercel Preview/Production 배포

## Program Evidence Policy Index Addition (2026-06-29)

- program-evidence-policy.md
  - 사업별 집행 증빙서류 PDF를 기준으로 비목, 하위 유형, 증빙 요구사항을 생성하는 정책
  - 관련 기능: 사업 등록 정책 파일, 정책 초안 검수/확정, 지출 카드 사업별 증빙 자동 세팅
