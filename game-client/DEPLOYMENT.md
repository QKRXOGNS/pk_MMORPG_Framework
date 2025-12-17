# 🚀 배포 가이드

Idle RPG 프로젝트를 프로덕션 환경에 배포하는 방법입니다.

---

## 📦 배포 전 체크리스트

### 필수 설정 확인

- [x] Firebase 프로젝트 생성 및 설정 완료
- [x] `src/firebase.ts`에 본인의 Firebase 설정 입력
- [x] `game-server/firebase.js`에 Firebase 설정 입력
- [x] Firestore 데이터베이스 규칙 설정
- [x] 게임 서버 배포 완료 및 URL 확인

---

## 🌐 1. 게임 서버 배포 (Render)

게임 서버를 먼저 배포해야 클라이언트에서 서버 URL을 설정할 수 있습니다.

### Render 배포 단계

1. **Render 계정 생성**: [render.com](https://render.com)

2. **New Web Service 생성**
   - "New +" → "Web Service"
   - GitHub 리포지토리 연결

3. **서비스 설정**
   ```
   Name: idle-rpg-server (또는 원하는 이름)
   Root Directory: game-client/game-server
   Environment: Node
   Build Command: npm install
   Start Command: node index.js
   ```

4. **환경 변수 설정** (필요시)
   - Firebase 관련 민감 정보는 환경 변수로 관리 가능

5. **배포 시작** → 배포 완료 후 서버 URL 확인
   - 예: `https://idle-rpg-server.onrender.com`

### 서버 작동 확인

```bash
# Health check (서버가 응답하는지 확인)
curl https://your-server-url.onrender.com
```

---

## 🖥️ 2. 클라이언트 배포 (Vercel)

### Vercel 배포 단계

1. **Vercel 계정 생성**: [vercel.com](https://vercel.com)

2. **프로젝트 Import**
   - "New Project" → GitHub 리포지토리 선택

3. **프로젝트 설정**
   ```
   Framework Preset: Vite
   Root Directory: game-client
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

4. **환경 변수 추가**
   
   Vercel 프로젝트 설정 → Environment Variables:
   ```
   VITE_SERVER_URL=https://your-server-url.onrender.com
   ```

5. **배포** → 배포 완료 후 클라이언트 URL 확인
   - 예: `https://idle-rpg.vercel.app`

---

## 🔐 3. Firebase 배포 설정

### Authorized Domains 추가

Firebase Console → Authentication → Settings → Authorized domains:

1. 배포된 Vercel 도메인 추가
   - 예: `idle-rpg.vercel.app`
   - Vercel 커스텀 도메인 사용 시 그것도 추가

2. 개발용 localhost도 유지
   - `localhost`

### Firestore Security Rules

Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profiles: 읽기는 모두, 쓰기는 본인만
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Game data: 읽기는 모두, 쓰기는 서버만 (서버 인증 설정 필요)
    match /monsters/{document=**} {
      allow read: if true;
      allow write: if false; // 서버에서만 쓰기
    }
    
    match /items/{document=**} {
      allow read: if true;
      allow write: if false;
    }
    
    match /serverConfig/{document=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

**보안 규칙 배포**: "게시" 버튼 클릭

---

## 🧪 4. 배포 테스트

### 기본 기능 테스트

1. **로그인 테스트**
   - Google 로그인 정상 작동 확인
   - 사용자 프로필 생성 확인

2. **캐릭터 생성**
   - 닉네임 입력 및 직업 선택
   - Firestore에 데이터 저장 확인

3. **게임 플레이**
   - 게임 서버 연결 확인 (WebSocket)
   - 캐릭터 이동 및 전투
   - 아이템 획득 및 인벤토리

4. **멀티플레이어**
   - 다른 브라우저/기기에서 동시 접속
   - 다른 플레이어 표시 확인

### 성능 확인

- **Lighthouse 점수** (Chrome DevTools)
  - Performance: 90+ 목표
  - Accessibility: 90+ 목표

- **로딩 시간**
  - First Contentful Paint < 2초
  - Time to Interactive < 3초

---

## 🔄 5. 업데이트 및 재배포

### 코드 수정 후 재배포

**Vercel (클라이언트)**:
- GitHub에 Push하면 자동 배포
- 또는 Vercel Dashboard에서 "Redeploy" 클릭

**Render (서버)**:
- GitHub에 Push하면 자동 배포
- 또는 Render Dashboard에서 "Manual Deploy" 클릭

### 환경 변수 변경

1. Vercel/Render Dashboard에서 Environment Variables 수정
2. 재배포 (변경 사항 적용)

---

## 📊 6. 모니터링

### Vercel Analytics (선택)

Vercel 프로젝트 설정 → Analytics 활성화
- 실시간 방문자 추적
- 페이지 성능 모니터링

### Firebase Console 모니터링

- **Authentication**: 사용자 수, 로그인 방법
- **Firestore**: 읽기/쓰기 횟수, 스토리지 사용량
- **Performance Monitoring** (선택): 앱 성능 추적

### Render 로그 확인

Render Dashboard → Logs:
- 서버 에러 및 경고 확인
- WebSocket 연결 상태 모니터링

---

## 🛠️ 문제 해결

### 배포 실패

**Vercel Build Error**:
- `package.json`의 의존성 확인
- Node 버전 호환성 확인
- Build 로그에서 에러 메시지 확인

**Render Deployment Failed**:
- `game-server/package.json` 존재 확인
- Node 버전 호환성 확인 (18+ 권장)
- Deploy 로그 확인

### Firebase 연결 에러

- Firebase 설정(`firebaseConfig`)이 올바른지 확인
- Authorized domains에 배포 도메인 추가 확인
- Firestore 규칙이 너무 제한적이지 않은지 확인

### WebSocket 연결 실패

- `VITE_SERVER_URL`이 올바른지 확인 (https:// 포함)
- 서버가 실행 중인지 Render 로그로 확인
- CORS 설정 확인 (서버 `index.js`)

---

## 🎉 배포 완료!

축하합니다! 게임이 성공적으로 배포되었습니다.

**다음 단계**:
- 친구들에게 게임 링크 공유
- 피드백 수집 및 개선
- 새로운 기능 추가 및 업데이트

**배포 URL 공유 예시**:
```
게임 클라이언트: https://your-app.vercel.app
게임 서버: https://your-server.onrender.com
```

---

## 📚 추가 자료

- [Vercel 공식 문서](https://vercel.com/docs)
- [Render 공식 문서](https://render.com/docs)
- [Firebase Hosting 문서](https://firebase.google.com/docs/hosting)
- [Vite 배포 가이드](https://vitejs.dev/guide/static-deploy.html)

