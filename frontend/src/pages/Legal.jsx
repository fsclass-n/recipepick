
const DOCS = {
  terms: {
    title: "이용약관",
    updated: "2026-11-17",
    sections: [
      ["제1조 (목적)", "이 약관은 RecipePick(이하 \"서비스\")이 제공하는 마트 할인 정보 조회, 냉장고 재고 관리, AI 레시피 창작 서비스의 이용 조건과 절차, 이용자와 서비스의 권리·의무를 규정합니다."],
      ["제2조 (서비스 내용)", "서비스는 공개된 마트 할인 정보를 수집·제공하고, 이용자가 입력한 냉장고 재료와 건강 정보를 바탕으로 생성형 AI(Google Gemini)를 활용해 레시피를 추천합니다."],
      ["제3조 (정보의 정확성)", "할인 정보는 각 마트 공개 페이지를 기준으로 수집되며 실제 매장 가격·재고와 다를 수 있습니다. DEMO로 표시된 정보는 시뮬레이션 데이터입니다."],
      ["제4조 (건강 정보 관련 고지)", "AI가 생성한 레시피와 영양 정보는 일반적인 식단 참고용이며 의학적 진단·처방을 대체하지 않습니다. 질환이 있는 경우 반드시 의료진과 상담하세요."],
      ["제5조 (이용자의 의무)", "이용자는 타인의 계정을 도용하거나 서비스의 정상적인 운영을 방해하는 행위를 해서는 안 됩니다."],
      ["제6조 (서비스 변경 및 중단)", "서비스는 운영상·기술상 필요에 따라 제공 내용을 변경하거나 일시 중단할 수 있으며, 중요한 변경은 사전에 공지합니다."],
    ],
  },
  privacy: {
    title: "개인정보처리방침",
    updated: "2026-11-17",
    sections: [
      ["1. 수집하는 개인정보", "필수: 이메일, 이름, 비밀번호(암호화 저장) / 소셜 로그인 시 제공자 식별자·이메일·닉네임. 선택: 건강 관리 목표, 알레르기 식품, 1일 목표 열량, 냉장고·장바구니 재료."],
      ["2. 이용 목적", "회원 식별 및 로그인, 할인 매칭 알림 발송, 건강 상태 맞춤 레시피 생성, 서비스 개선을 위한 통계 분석에 이용합니다."],
      ["3. AI 처리 위탁", "레시피 생성 시 재료 목록과 건강 목표, 알레르기 정보가 Google Gemini API로 전송됩니다. 이름·이메일 등 식별 정보는 전송하지 않습니다."],
      ["4. 보관 및 파기", "회원 탈퇴 시 지체 없이 파기합니다. 단, 관련 법령에 따라 보관이 필요한 정보는 해당 기간 동안 보관합니다."],
      ["5. 이용자의 권리", "이용자는 언제든지 건강 프로필에서 개인정보를 조회·수정할 수 있으며, 삭제 및 탈퇴를 요청할 수 있습니다."],
      ["6. 개인정보 보호책임자", "홍기흥 · whyeil@naver.com"],
    ],
  },
};

export default function Legal({ type }) {
  const doc = DOCS[type];
  return (
    <div className="container-x max-w-3xl py-14 sm:py-20">
      <p className="eyebrow">Policy</p>
      <h1 className="mt-3 text-4xl text-leaf-950 sm:text-5xl dark:text-stone-50">{doc.title}</h1>
      <p className="mt-3 text-sm text-stone-500">시행일 {doc.updated}</p>
      <div className="mt-10 divide-y divide-stone-200 border-y border-stone-200 dark:divide-ink-line dark:border-ink-line">
        {doc.sections.map(([h, body]) => (
          <section key={h} className="grid gap-2 py-7 sm:grid-cols-[220px_1fr] sm:gap-8">
            <h2 className="text-lg text-leaf-900 dark:text-stone-100">{h}</h2>
            <p className="text-[15px] leading-relaxed text-stone-600 dark:text-stone-300">{body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
