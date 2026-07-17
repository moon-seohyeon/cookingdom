// Firebase 프로젝트 설정
// Firebase 콘솔(https://console.firebase.google.com) > 프로젝트 설정 > 일반 > "내 앱" 에서
// 웹 앱을 하나 추가하면 아래와 같은 형태의 설정 객체를 받을 수 있습니다.
// 그 값을 아래에 그대로 붙여넣어 주세요. (이 값들은 공개되어도 안전한 값입니다 - 실제 접근 제어는
// Firestore 보안 규칙으로 처리합니다)
export const firebaseConfig = {
  apiKey: "AIzaSyDYcBr3kL-Sa5kaNendqSsd6H9opCvNqcg",
  authDomain: "don-t-starve---soundplus.firebaseapp.com",
  projectId: "don-t-starve---soundplus",
  storageBucket: "don-t-starve---soundplus.firebasestorage.app",
  messagingSenderId: "909868469975",
  appId: "1:909868469975:web:f98dbf451e2fbd24082a92",
};

// 관리자(문보미) 전용 기능 잠금 해제용 PIN.
// 원하는 숫자/문자로 바꿔서 사용하세요. (보안 목적이 아니라 실수로 다른 사람이
// 누르지 않게 하는 용도입니다 - 코드가 공개 저장소에 있으므로 완전한 보안은 아닙니다)
export const ADMIN_PIN = "REPLACE_ME";
