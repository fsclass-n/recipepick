// 셰프 스타일 레시피 — 키는 백엔드 schemas.CHEF_STYLES 와 1:1 대응.
// 각 셰프의 공개적으로 알려진 요리 철학에서 영감을 받은 스타일이며, 공식 레시피나 제휴가 아니다.
export const CHEF_STYLES = [
  { key: "", chef: "AI 영양사", label: "기본", icon: "fa-user-doctor", desc: "건강 기준에 맞춘 균형 잡힌 가정식" },
  { key: "baek", chef: "백종원", label: "대중 집밥", icon: "fa-house-chimney", desc: "구하기 쉬운 재료와 숟가락 계량, 실패 없는 집밥 공식" },
  { key: "ahn", chef: "안성재", label: "파인다이닝", icon: "fa-star", desc: "재료 본연의 맛, 정확한 온도·시간과 섬세한 플레이팅" },
  { key: "lee", chef: "이연복", label: "정통 중식", icon: "fa-fire-burner", desc: "센 불 웍 요리, 파기름과 불맛을 살린 빠른 중식" },
  { key: "choi", chef: "최현석", label: "창작 퓨전", icon: "fa-wand-magic-sparkles", desc: "의외의 재료 조합과 소스 아이디어로 만드는 창작 요리" },
  { key: "shim", chef: "심영순", label: "전통 한식", icon: "fa-bowl-rice", desc: "양념장 비율과 고명까지 정갈한 전통·궁중 한식" },
];
export const chefStyle = (key) => CHEF_STYLES.find((c) => c.key === (key || ""));
