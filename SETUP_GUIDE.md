# 🚀 Idle RPG 설정 가이드

이 프로젝트는 **저작권이 있는 리소스와 개인 키가 제거된 상태**로 공유되었습니다.  
아래 가이드를 따라 프로젝트를 완전히 설정하세요.

---

## ⚠️ 필수 설정 항목

### 1. Firebase 설정 (필수)

게임의 인증 및 데이터베이스 기능을 위해 Firebase 설정이 필요합니다.

#### 1-1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름 입력 및 생성

#### 1-2. Authentication 설정

1. Firebase Console → Authentication → "시작하기"
2. "Google" 로그인 제공업체 활성화
3. 프로젝트 공개용 이름 설정

#### 1-3. Firestore Database 생성

1. Firebase Console → Firestore Database → "데이터베이스 만들기"
2. 프로덕션 모드 또는 테스트 모드 선택
3. 리전 선택 (asia-northeast3 권장)

#### 1-4. Firebase 설정 적용

**클라이언트 설정** (`game-client/src/firebase.ts`):

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

**서버 설정** (`game-client/game-server/firebase.js`):
- 위와 동일한 설정 정보 입력

> 💡 Firebase SDK 설정 정보는:  
> Firebase Console → 프로젝트 설정 → 일반 → 내 앱 → SDK 설정 및 구성

---

### 2. 캐릭터/몬스터 스프라이트 추가 (선택)

현재 게임은 **색상 박스**로 캐릭터를 표시합니다.  
스프라이트를 추가하면 더 풍부한 비주얼을 경험할 수 있습니다.

#### 2-1. 스프라이트 폴더 구조

`game-client/public/sprites/` 디렉토리에 다음 구조로 배치:

```
public/sprites/
├── ske_sword/              # 전사
│   ├── sword_blue/         # 플레이어용
│   │   ├── walk_1.png ~ walk_6.png
│   │   ├── ready_1.png ~ ready_3.png
│   │   ├── attack1_1.png ~ attack1_6.png
│   │   └── dead_near_1.png ~ dead_near_6.png
│   ├── sword_red/          # 몬스터용 (공격형)
│   └── sword_green/        # 몬스터용 (패시브)
├── ske_archer/             # 궁수 (위와 동일 구조)
├── ske_mage/               # 마법사 (attack1은 4프레임)
└── ske_shield/             # 가디언 (위와 동일 구조)
```

#### 2-2. 무료 스프라이트 소스

- [OpenGameArt.org](https://opengameart.org/)
- [itch.io - Game Assets](https://itch.io/game-assets/free)
- [Kenney.nl](https://kenney.nl/)
- [Craftpix.net](https://craftpix.net/freebies/)

#### 2-3. 코드 활성화

스프라이트를 추가한 후 `game-client/src/components/GameCanvas.tsx` 수정:

1. **loadImages() 함수** (118-153줄): 주석 해제
2. **drawEntity() 함수** (648-687줄): 스프라이트 렌더링 코드 주석 해제
3. **박스 렌더링 코드** (580-644줄): 주석 처리 또는 삭제

---

## 🔧 개발 환경 설정

### 필수 도구

- Node.js 18+ 
- npm 또는 yarn

### 설치 및 실행

```bash
# 의존성 설치
cd game-client
npm install

# 환경 변수 설정
echo "VITE_SERVER_URL=http://localhost:3001" > .env.local

# 개발 서버 실행 (클라이언트)
npm run dev
# → http://localhost:5173

# 게임 서버 실행 (별도 터미널)
cd game-server
npm install
node index.js
# → http://localhost:3001
```

---

## 🌐 배포 가이드

### Vercel 배포 (클라이언트)

1. Vercel에 프로젝트 연결
2. 설정:
   - **Root Directory**: `game-client`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. 환경 변수 추가:
   ```
   VITE_SERVER_URL=https://your-game-server.onrender.com
   ```

### Render 배포 (게임 서버)

1. Render에 새 Web Service 생성
2. 설정:
   - **Root Directory**: `game-client/game-server`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
3. Firebase 설정 완료 확인

### Firebase 승인 도메인 추가

Firebase Console → Authentication → Settings → Authorized domains:
- Vercel 도메인 추가 (예: `your-app.vercel.app`)
- 로컬 테스트용: `localhost`

---

## 📋 체크리스트

설정이 완료되었는지 확인하세요:

- [ ] Firebase 프로젝트 생성 및 Authentication 활성화
- [ ] Firebase Firestore 데이터베이스 생성
- [ ] `src/firebase.ts` Firebase 설정 입력
- [ ] `game-server/firebase.js` Firebase 설정 입력
- [ ] (선택) 스프라이트 이미지 추가 및 코드 활성화
- [ ] `.env.local` 파일 생성 및 서버 URL 설정
- [ ] 클라이언트 개발 서버 실행 성공
- [ ] 게임 서버 실행 성공
- [ ] 로그인 및 캐릭터 생성 테스트
- [ ] 게임 플레이 정상 동작 확인

---

## 🆘 문제 해결

### Firebase 인증 에러
- Firebase Console에서 Google 로그인이 활성화되었는지 확인
- 승인된 도메인에 localhost와 배포 도메인이 추가되었는지 확인

### 게임 서버 연결 실패
- `.env.local`의 `VITE_SERVER_URL`이 올바른지 확인
- 게임 서버가 실행 중인지 확인 (기본 포트: 3001)
- CORS 에러 시 서버 콘솔 로그 확인

### 스프라이트가 표시되지 않음
- 스프라이트 파일 경로 확인 (`/public/sprites/...`)
- `GameCanvas.tsx`의 `loadImages()` 주석 해제 확인
- 브라우저 콘솔에서 이미지 로딩 에러 확인

---

## 📞 추가 지원

문제가 지속되면 다음을 확인하세요:
- [게임 클라이언트 README](game-client/README.md)
- [Firebase 공식 문서](https://firebase.google.com/docs)
- GitHub Issues 페이지

**Happy Gaming! 🎮**

