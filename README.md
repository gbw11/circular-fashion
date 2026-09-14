# Circular Fashion — 순환 패션 업사이클 플랫폼

> 버려질 패션 소재가 새로운 제품으로 순환하도록 연결하고, 그 순환 과정을 끝까지 검증 가능한 이력으로 남기는 서비스입니다.

## 프로젝트 개요

폐기되는 원단·의류를 필요로 하는 업사이클 브랜드에 직접 연결하는 **P2P 마켓플레이스**와, 그 소재가 제품이 되기까지의 과정을 블록체인으로 기록해 누구나 확인할 수 있게 하는 **트레이서빌리티(이력 추적)** 기능을 하나의 흐름(Material Journey)으로 묶은 서비스입니다.

```
소재 등록 → 마켓플레이스 거래 → 결제 → 배송·수령 → 가공 의뢰 → 생산 → 제품화 → QR로 이력 조회
```

- 공급업체(SUPPLIER)가 등록한 폐소재를 브랜드(BRAND)가 구매하고, 가공업체(PROCESSOR)를 거쳐 제품으로 만들어지는 전 과정을 각 참여자가 자신의 지갑으로 직접 서명합니다.
- 블록체인은 "진짜 폐소재인지"를 판별하지는 못하지만, **"누가 어떤 내용을 언제 기록·확인했는지"** 를 어느 한쪽이 임의로 바꾸기 어렵게 공동 관리합니다.
- 최종 소비자(CONSUMER)는 지갑 없이 제품을 구매하고 QR을 스캔해 원재료 출처부터 제작 과정까지의 이력을 조회합니다.

### 참여자

| 역할 | 지갑 | 하는 일 |
| --- | --- | --- |
| SUPPLIER | ✅ | 폐원단·데드스톡 등록·판매, 발생 정보 서명 |
| BRAND | ✅ | 소재 구매·수령 인증, 가공 의뢰, 생산, 제품 등록 |
| PROCESSOR | ✅ | 소재 인수·가공, 결과 수량 기록·서명 |
| CONSUMER | ❌ | 제품 구매, QR로 이력 조회 |
| ADMIN | — | 사용자·가공업체 심사, 모니터링 |

### 기술 스택

| 영역 | 스택 |
| --- | --- |
| Backend | Spring Boot, MySQL |
| Frontend | React, TypeScript, Vite |
| AI | Python |
| Blockchain | Solidity(Hardhat), 이더리움 계열 테스트넷 |
| Infra | AWS EC2, Docker Compose, Nginx, Jenkins(Multibranch CI/CD) |

### 이 저장소 구조

원래 프로젝트는 GitLab에서 파트별 장기 브랜치(`backend/*`, `frontend/*`, `ai/*`, `blockchain/*`, `deploy/*`)로 나뉘어 독립적으로 운영됩니다. 이 저장소는 그 결과물을 한 번에 볼 수 있도록 정리한 **포트폴리오 전용 스냅샷**이며, 실제 작업은 팀 GitLab에서 이루어집니다.

- `master` — 각 파트 안정 버전(`*/master`)을 `backend/`, `frontend/`, `ai/`, `blockchain/` 서브디렉토리로 모은 브랜치
- `develop` — 각 파트 개발 버전(`*/develop`) + 배포 설정(`deploy/master`)을 서브디렉토리로 모은 브랜치

## 저의 역할

6인 팀 중 **인프라(Infra) 담당**으로, 이후 **User/Wallet 인증**과 **소재(Material) 관리 도메인**까지 맡았습니다.

- **인프라 / DevOps**
  - AWS EC2 위에 Docker Compose 기반 배포 환경 구축 (Nginx 리버스 프록시, HTTPS, 도메인 연결)
  - Jenkins Multibranch Pipeline으로 파트별 브랜치(`*/develop`, `*/master`) CI/CD 자동화, 헬스체크 실패 시 자동 롤백
  - 운영 스택과 완전히 격리된 **상시 통합 테스트 환경**(`/test/`) 설계·구축 — 각 파트가 `develop`에 병합할 때마다 자동 배포되어, 머지 전에도 실제 통합 상태를 확인 가능
  - 스키마 변경(마이그레이션) 누락으로 배포가 죽는 문제를 배포 전 자동 검증 + 안전한 경우 자동 적용하는 preflight 도구 구축
  - 환경변수·시크릿 관리, CORS·인증 관련 운영 장애 대응

- **User / Wallet 인증**
  - 지갑 서명 기반 로그인 기능

- **Material / Product 관리**
  - 소재(Material) 등록·조회·수정, 보유 수량(Balance/Available) 관리
  - 소재 발생 증빙(Evidence), 소재 이력(Lineage) 조회
  - 생산 배치(ProductionBatch) 및 투입/산출(Input/Output) 관리, 소재 소비(Consume) 처리
  - 잔여 소재(Scrap Material) 생성, 업사이클 비율(Upcycle Ratio) 계산
  - 제품 모델/개별 제품(ProductModel/ProductItem) 생성·관리
