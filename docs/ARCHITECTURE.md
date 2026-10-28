# AI 법률 로드맵 — 모듈 구조

대상: http://localhost:3700/ · 기존 UI와 저장·API 계약은 유지하고 코드 소유 영역을 분리합니다.

## 화면 구성

| 영역 | 담당 파일 | 책임 |
|---|---|---|
| ① 대화창 | src/features/conversation/ | 기록, 입력, 메시지, 확인·추가 질문, 모델 선택 UI |
| ② 선택지 지도 | src/features/map/ | 지도 카드, 연결선, 지도 헤더, 모바일 지도, 지도 상태 |
| ③ 살펴볼 방법 | src/features/methods/ | 선택된 방법의 절차·조건·서류·근거와 실행 버튼 |

## 공통 연결

- src/app/page.tsx: 레이아웃 조립, 왼쪽 메뉴, 세 영역 배치, 공통 다이얼로그만 담당.
- src/features/workspace/use-legal-workspace.ts: 유일한 공유 상태 조정자. 대화 저장·선택, API 호출, 질문·분석·상세·진행 상태, 로딩·오류를 관리.
- src/features/workspace/conversation-tabs.tsx: 전체 대화 탭과 삭제 확인.
- src/features/workspace/model-settings.tsx: 전체 모델 연결 설정.
- src/features/shared/: 모바일 레이아웃 판별, 날짜 표시, 분석 진행 표시 등 공통 기능.
- src/lib/: LegalCase/노드 등 도메인 타입, 흐름도 계산, 법률 관련 비즈니스 로직.
- src/app/api/: 기존 서버 엔드포인트(변경 없음).

## 변경 영향 규칙

1. 대화창은 지도·상세 내부 구현을 import하지 않습니다. 데이터 변경은 콜백을 통해 공통 조정자로 전달합니다.
2. 지도는 LegalCase와 선택 노드 ID를 받아 렌더링합니다. 카드를 누르면 onSelectNode를 통해 공유 선택 상태만 갱신합니다.
3. 살펴볼 방법은 선택한 RoadmapNode와 출처를 전달받습니다. 진행·상세 재요청도 부모 콜백만 호출합니다.
4. 두 화면 이상에서 쓰는 상태만 공통 조정자에 둡니다. 같은 저장 데이터를 화면별로 복제하지 않습니다.
5. 디자인 변경은 각 영역의 CSS에서 우선 처리하되, 공통 레이아웃과 색상 토큰 변경은 전체 영향 여부를 확인합니다.
6. 기존 localStorage 키, 분석 API 입력·응답 계약, 현재 작동하는 UI/모바일 흐름은 유지합니다.

## 작업 위치 안내

| 수정 목적 | 변경 위치 |
|---|---|
| 대화 내용·작성·기록 | src/features/conversation/ |
| 카드·화살표·지도 확대·모바일 지도 | src/features/map/ |
| 우측 절차·서류·상태 버튼 | src/features/methods/ |
| API 응답 반영·대화 저장·진행 상태 | src/features/workspace/use-legal-workspace.ts |
| 화면 전체 배치와 메뉴 | src/app/page.tsx, src/features/workspace/*.css |
| 공통 타입·절차 계산 | src/lib/ |

## 검증

PowerShell에서 아래 명령을 실행합니다.

    Set-Location 'C:\Users\동호\Projects\ai-legal-roadmap'
    npm run typecheck
    node scripts/verify-modules.mjs

백업: .ux-backup/architecture-before-20261027-1533.zip (수정 전 src 전체).
전체 테스트 참고: core.test.mjs의 Node ESM 상대경로 오류와 requested-ui.test.mjs의 제거된 history-example 선택자는 기존 테스트 제약입니다. 추가로 mobile-roadmap.test.mjs의 2건은 작업 도중 별도로 수정된 src/lib/mobile-roadmap.ts의 기대 동작과 현재 구현 차이로 실패 중입니다. 구조 분리 범위를 벗어나므로 해당 로직은 임의 변경하지 않았습니다. 모듈 분리 브라우저 검증과 독립적인 핵심 로직 테스트 8건은 통과했습니다.
