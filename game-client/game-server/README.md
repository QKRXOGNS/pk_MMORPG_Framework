# Idle RPG - Game Server

Node.js + Socket.IO 기반 실시간 게임 서버입니다.

## 📋 기능

- 실시간 멀티플레이어 게임 로직
- Socket.IO를 통한 양방향 통신
- Firebase Firestore 연동 (게임 데이터)
- 몬스터 AI 및 전투 시스템
- 아이템 드랍 및 경험치 시스템

## 🚀 로컬 실행 방법

### 1. 의존성 설치
```bash
npm install
```

### 2. 서버 실행
```bash
node index.js
```

서버는 기본적으로 `http://localhost:3001`에서 실행됩니다.

## 🌐 배포 (Render.com)

### 배포 설정
- **Root Directory**: `game-client/game-server` (전체 리포지토리 기준)
- **Build Command**: `npm install`
- **Start Command**: `node index.js`
- **Environment**: Node

### 환경 변수 (필요시)
현재는 Firebase 설정이 코드에 포함되어 있습니다. 보안을 위해 추후 환경 변수로 분리 권장:
```
FIREBASE_API_KEY=your_api_key
FIREBASE_PROJECT_ID=your_project_id
```

## 📁 파일 구조

```
game-server/
├── index.js              # 메인 서버 로직
├── firebase.js           # Firebase 초기화
├── refactorDatabase.js   # DB 데이터 초기화 스크립트
├── uploadGameData.js     # 게임 데이터 업로드 유틸
├── package.json          # 의존성 관리
└── README.md
```

## 🔧 주요 의존성

- `express`: HTTP 서버
- `socket.io`: 실시간 통신
- `firebase`: Firestore 연동
- `cors`: CORS 설정

## 📝 참고사항

- 서버는 클라이언트와 독립적으로 배포됩니다.
- Render 무료 플랜 사용 시 15분 비활동 후 절전 모드 진입 (재시작 시 30초 딜레이)
- Firebase Firestore 데이터는 별도로 관리됩니다.

## 🔗 관련 리포지토리

- 클라이언트: [pkRPG_TEST](https://github.com/QKRXOGNS/pkRPG_TEST.git)

