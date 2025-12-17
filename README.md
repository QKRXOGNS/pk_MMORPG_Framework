# 🎮 Idle RPG Framework

실시간 멀티플레이어 RPG 게임 프레임워크입니다.  
React + TypeScript + Socket.IO + Firebase 기반으로 제작되었습니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

---

## ⚠️ 중요 공지

이 프로젝트는 **저작권이 있는 리소스와 개인 키가 제거된 상태**로 공유되었습니다.

### 제거된 항목
- ❌ Firebase 설정 키 (플레이스홀더로 교체)
- ❌ 캐릭터/몬스터 스프라이트 이미지 (~1,000개 PNG 파일)
- ❌ 이펙트 및 애니메이션 이미지

### 현재 상태
- ✅ 박스 렌더링 시스템으로 게임 플레이 가능
- ✅ 모든 게임 로직 정상 작동
- ✅ 상세한 설정 가이드 포함

**시작하기 전에 [SETUP_GUIDE.md](./SETUP_GUIDE.md)를 반드시 읽어주세요!**

---

## 🚀 빠른 시작

### 1. Firebase 설정 (필수)

```bash
# 1. Firebase Console에서 프로젝트 생성
# 2. src/firebase.ts에 본인의 Firebase 설정 입력
# 3. game-server/firebase.js에도 동일하게 설정
```

자세한 가이드: [SETUP_GUIDE.md](./SETUP_GUIDE.md#1-firebase-설정-필수)

### 2. 설치 및 실행

```bash
# 클라이언트 설치
cd game-client
npm install

# 환경 변수 설정
echo "VITE_SERVER_URL=http://localhost:3001" > .env.local

# 클라이언트 실행
npm run dev

# 서버 실행 (별도 터미널)
cd game-server
npm install
node index.js
```

### 3. 브라우저 접속

```
http://localhost:5173
```

---

## 🎨 주요 기능

### 게임 시스템
- ⚔️ **실시간 전투**: Socket.IO 기반 멀티플레이어
- 🤖 **자동 전투**: AI 타겟팅 및 자동 공격
- 👥 **4가지 직업**: 전사, 궁수, 마법사, 가디언
- 📈 **레벨 시스템**: 경험치, 레벨업, 스탯 포인트 분배

### 아이템 시스템
- 🗡️ **장비 시스템**: 무기, 갑옷, 각반, 머리 (4슬롯)
- ⭐ **5단계 등급**: 일반, 희귀, 서사, 영웅, 전설
- 🎒 **24칸 인벤토리**: 그리드 기반 인벤토리
- ⚗️ **물약 시스템**: 자동 사용 및 퀵슬롯
- 🔨 **아이템 분해**: 수동/자동 분해 (등급별 설정)

### 기술 스택
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.IO
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth (Google Login)

---

## 📚 문서

| 문서 | 설명 |
|------|------|
| [SETUP_GUIDE.md](./SETUP_GUIDE.md) | 전체 설정 가이드 (Firebase, 스프라이트, 개발 환경) |
| [CHANGES.md](./CHANGES.md) | 공유용 버전 변경 사항 상세 |
| [game-client/README.md](./game-client/README.md) | 클라이언트 상세 문서 |
| [game-client/DEPLOYMENT.md](./game-client/DEPLOYMENT.md) | Vercel/Render 배포 가이드 |

---

## 🎮 현재 플레이스홀더 시스템

스프라이트 없이도 게임이 정상 작동합니다:

| 요소 | 표현 방식 |
|------|----------|
| **플레이어** | 색상 박스 (전사=파랑, 궁수=주황, 마법사=보라, 가디언=초록) |
| **몬스터** | 색상 박스 (빨강=공격형, 초록=패시브) |
| **상태** | 테두리 색상 (공격=빨강, 사망=회색) |
| **이름/HP** | 텍스트 및 HP 바 표시 |

### 스프라이트 추가하기 (선택)

스프라이트를 추가하면 더 풍부한 비주얼을 경험할 수 있습니다:

1. **무료 스프라이트 다운로드**:
   - [OpenGameArt.org](https://opengameart.org/)
   - [itch.io - Game Assets](https://itch.io/game-assets/free)
   - [Kenney.nl](https://kenney.nl/)

2. **폴더 구조에 맞게 배치**:
   ```
   game-client/public/sprites/
   ├── ske_sword/
   │   └── sword_blue/
   │       ├── walk_1.png ~ walk_6.png
   │       ├── ready_1.png ~ ready_3.png
   │       └── ...
   ```

3. **코드 활성화**:
   - `GameCanvas.tsx`의 주석 해제

자세한 가이드: [SETUP_GUIDE.md](./SETUP_GUIDE.md#2-캐릭터몬스터-스프라이트-추가-선택)

---

## 📁 프로젝트 구조

```
pk_MMORPG_Framework/
├── game-client/              # 게임 클라이언트
│   ├── src/
│   │   ├── components/       # React 컴포넌트
│   │   ├── hooks/            # 커스텀 훅
│   │   ├── data/             # 게임 데이터
│   │   └── firebase.ts       # Firebase 설정 ⚠️
│   ├── public/               # 정적 파일
│   └── game-server/          # 게임 서버
│       ├── index.js          # 서버 메인
│       └── firebase.js       # Firebase 설정 ⚠️
├── SETUP_GUIDE.md            # 설정 가이드
├── CHANGES.md                # 변경 사항
└── README.md                 # 이 파일
```

---

## 🔧 개발

### 필수 요구사항
- Node.js 18+
- npm 또는 yarn
- Firebase 계정

### 개발 모드

```bash
# 클라이언트
cd game-client
npm run dev

# 서버
cd game-client/game-server
node index.js
```

### 빌드

```bash
cd game-client
npm run build
```

---

## 🌐 배포

### Vercel (클라이언트)
```bash
# Root Directory: game-client
# Framework: Vite
# Build Command: npm run build
# Output Directory: dist
```

### Render (서버)
```bash
# Root Directory: game-client/game-server
# Build Command: npm install
# Start Command: node index.js
```

자세한 배포 가이드: [game-client/DEPLOYMENT.md](./game-client/DEPLOYMENT.md)

---

## 🆘 문제 해결

### Firebase 인증 에러
✅ Google 로그인 활성화 확인  
✅ Authorized domains에 localhost 추가

### 게임 서버 연결 실패
✅ `.env.local`의 `VITE_SERVER_URL` 확인  
✅ 서버 실행 상태 확인 (포트 3001)

### 더 많은 문제 해결
👉 [SETUP_GUIDE.md](./SETUP_GUIDE.md#-문제-해결)

---

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

```
Copyright (c) 2025 QKRXOGNS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

전체 라이선스: [LICENSE](./LICENSE)

---

## 🤝 기여

이슈 및 Pull Request는 언제나 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📞 문의

프로젝트에 대한 질문이나 제안사항이 있으시면:
- GitHub Issues: [pk_MMORPG_Framework/issues](https://github.com/QKRXOGNS/pk_MMORPG_Framework/issues)

---

## ⭐ 지원

이 프로젝트가 도움이 되었다면 Star⭐를 눌러주세요!

---

**Made with ❤️ by QKRXOGNS**

**Happy Gaming! 🎮**

