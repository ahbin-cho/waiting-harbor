// 카카오톡 공유: 받은 사람 카톡에 등불 링크가 미리보기(사진, 이름, 남은 날)와 함께 가요.
// 열쇠(JavaScript 키)는 공개돼도 되는 값이라 환경 변수 VITE_KAKAO_JS_KEY 에 둬요.
// 카카오 개발자 콘솔에서 이 사이트 주소를 플랫폼(Web)에 등록해야 동작해요. 키가 없으면 버튼을 숨겨요.
// 미리보기 내용은 /l/아이디 주소의 og 태그(api/lantern.ts)를 카카오가 읽어 가서 만들어요.

const KEY = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
const SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";

type KakaoSDK = {
  isInitialized(): boolean;
  init(key: string): void;
  Share: { sendScrap(o: { requestUrl: string }): void };
};
declare global {
  interface Window {
    Kakao?: KakaoSDK;
  }
}

export const kakaoReady = () => !!KEY;

let loading: Promise<KakaoSDK> | null = null;
function load(): Promise<KakaoSDK> {
  if (window.Kakao) return Promise.resolve(window.Kakao);
  loading ??= new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = SDK;
    s.crossOrigin = "anonymous";
    s.onload = () => (window.Kakao ? ok(window.Kakao) : fail(new Error("kakao")));
    s.onerror = () => {
      loading = null;
      fail(new Error("kakao"));
    };
    document.head.append(s);
  });
  return loading;
}

/** 카카오톡으로 등불 링크 보내기 */
export async function shareKakao(url: string) {
  if (!KEY) throw new Error("kakao");
  const k = await load();
  if (!k.isInitialized()) k.init(KEY);
  k.Share.sendScrap({ requestUrl: url });
}
