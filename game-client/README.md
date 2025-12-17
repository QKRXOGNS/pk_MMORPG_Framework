# Idle RPG - Game Client

React + Vite + TypeScript 기반 실시간 멀티플레이어 RPG 게임 클라이언트입니다.

## 🎮 주요 기능

### 게임 시스템
- **실시간 멀티플레이어**: Socket.IO를 통한 실시간 전투 및 상호작용
- **자동 전투**: AI 기반 자동 타겟팅 및 공격
- **직업 시스템**: 전사, 궁수, 마법사, 가디언 4가지 직업
- **레벨 시스템**: 경험치 획득 및 레벨업, 스탯 포인트 분배

### 아이템 시스템
- **장비 시스템**: 무기, 갑옷, 각반, 머리 4개 슬롯
- **등급 시스템**: 일반, 희귀, 서사, 영웅, 전설 5단계
- **인벤토리**: 24칸 그리드 인벤토리
- **아이템 분해**: 수동/자동 분해 기능 (등급별 설정 가능)
- **물약 시스템**: 퀵슬롯 장착 및 자동 사용 (HP 기준 설정)

### 사용자 인증
- **Google 로그인**: Firebase Authentication 연동
- **캐릭터 생성**: 닉네임 및 직업 선택
- **데이터 저장**: Firestore를 통한 실시간 동기화

## 🚀 로컬 실행 방법

### 1. 의존성 설치
```bash
npm install
```

### 2. Firebase 설정

**⚠️ Firebase 설정 필수**: 이 프로젝트는 개인 Firebase 키가 제거되어 있습니다.

1. [Firebase Console](https://console.firebase.google.com/)에서 새 프로젝트 생성
2. Authentication 활성화 (Google 로그인 설정)
3. Firestore Database 생성
4. 프로젝트 설정에서 SDK 설정 정보 복사
5. `src/firebase.ts` 파일에서 `firebaseConfig` 객체를 본인의 설정으로 교체:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
```

6. **게임 서버용 Firebase 설정**: `game-server/firebase.js`도 동일하게 설정

### 3. 환경 변수 설정
프로젝트 루트에 `.env.local` 파일 생성:
```env
VITE_SERVER_URL=http://localhost:3001
```

### 4. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

## 🌐 배포 (Vercel)

### 배포 설정
- **Root Directory**: `game-client` (전체 리포지토리 기준)
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### 환경 변수 (Vercel)
Vercel 프로젝트 설정에서 추가:
```
VITE_SERVER_URL=https://your-server-url.onrender.com
```

### Firebase 배포 설정
Firebase Console에서 배포된 도메인을 승인된 도메인에 추가:
1. Firebase Console → Authentication → Settings
2. Authorized domains 탭
3. Vercel 도메인 추가 (예: `your-app.vercel.app`)

**⚠️ 주의**: `src/firebase.ts`와 `game-server/firebase.js`의 Firebase 설정이 완료되어야 배포가 정상 작동합니다.

## 📁 프로젝트 구조

```
game-client/
├── src/
│   ├── components/          # React 컴포넌트
│   │   ├── GameCanvas.tsx   # 게임 렌더링 및 Socket.IO 통신
│   │   ├── ChatBox.tsx      # 채팅 및 시스템 로그
│   │   ├── Login.tsx        # 로그인 화면
│   │   └── CharacterCreation.tsx  # 캐릭터 생성
│   ├── hooks/               # Custom Hooks
│   │   ├── usePotionSystem.ts     # 물약 시스템 로직
│   │   └── useInventorySystem.ts  # 인벤토리 로직
│   ├── data/
│   │   └── gameData.ts      # 게임 상수 및 설정
│   ├── firebase.ts          # Firebase 초기화
│   ├── App.tsx              # 메인 앱 컴포넌트
│   └── main.tsx             # 엔트리 포인트
├── public/
│   └── sprites/             # 게임 스프라이트 이미지
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## 🔧 주요 기술 스택

- **React 18**: UI 라이브러리
- **TypeScript**: 타입 안정성
- **Vite**: 빌드 도구
- **Tailwind CSS**: 스타일링
- **Socket.IO Client**: 실시간 통신
- **Firebase**: 인증 및 데이터베이스

## 🎨 스프라이트 설정 가이드

**⚠️ 중요: 이 프로젝트는 저작권이 있는 스프라이트를 제외하고 공유되었습니다.**

현재 게임은 **색상 박스 플레이스홀더**로 캐릭터와 몬스터를 렌더링합니다.  
직접 스프라이트를 추가하려면 아래 가이드를 따라주세요.

### 📦 스프라이트 폴더 구조

`/public/sprites/` 디렉토리에 다음 구조로 스프라이트를 배치하세요:

```
public/sprites/
├── ske_sword/              # 전사 (Warrior)
│   ├── sword_blue/
│   │   ├── walk_1.png ~ walk_6.png
│   │   ├── ready_1.png ~ ready_3.png
│   │   ├── attack1_1.png ~ attack1_6.png
│   │   └── dead_near_1.png ~ dead_near_6.png
│   ├── sword_red/          # 몬스터용 (빨강 = 공격형)
│   └── sword_green/        # 몬스터용 (초록 = 패시브)
├── ske_archer/             # 궁수 (Archer)
├── ske_mage/               # 마법사 (Mage)
└── ske_shield/             # 가디언 (Guardian)
```

### 🖼️ 스프라이트 요구사항

각 직업과 상태별로 필요한 프레임:
- **walk**: 6프레임 (걷기 애니메이션)
- **ready**: 3프레임 (대기 애니메이션)
- **attack1**: 6프레임 (공격 애니메이션, 마법사는 4프레임)
- **dead_near**: 6프레임 (사망 애니메이션)

### ⚙️ 코드 활성화 방법

1. **스프라이트 이미지 배치**: 위 폴더 구조대로 이미지 파일 추가
2. **GameCanvas.tsx 수정**:
   - `loadImages()` 함수의 주석 해제 (118-153줄)
   - `drawEntity()` 함수의 주석 처리된 스프라이트 렌더링 코드 활성화 (648-687줄)
   - 박스 렌더링 코드 제거 또는 주석 처리 (580-644줄)

### 🎨 추천 스프라이트 소스

무료 또는 오픈소스 스프라이트:
- [OpenGameArt.org](https://opengameart.org/)
- [itch.io - Game Assets](https://itch.io/game-assets/free)
- [Kenney.nl](https://kenney.nl/)
- [Craftpix.net (Free Section)](https://craftpix.net/freebies/)

### 💡 현재 플레이스홀더 시스템

스프라이트가 없어도 게임은 정상 작동합니다:
- **플레이어**: 색상 박스로 표시 (전사=파랑, 궁수=주황, 마법사=보라, 가디언=초록)
- **몬스터**: 색상 박스로 표시 (빨강=공격형, 초록=패시브)
- **상태 표시**: 테두리 색상으로 공격/사망 상태 표시

## 📝 개발 참고사항

### 환경 변수
- `VITE_SERVER_URL`: 게임 서버 주소 (기본값: `http://localhost:3001`)

### 빌드
```bash
npm run build
```

### 프리뷰 (빌드 결과 확인)
```bash
npm run preview
```

## 🔗 관련 리포지토리

- 서버: [pkserver](https://github.com/QKRXOGNS/pkserver.git)

## 📄 라이선스

Private Project

