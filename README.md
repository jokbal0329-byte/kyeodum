# 켜둠

켜두고 쓰는 타이머와 시계. https://kyeodum.ludlet.com

빌드 없는 정적 사이트. Cloudflare Workers 정적 자산(`wrangler.jsonc`, 배포에서 뺄 파일은 `.assetsignore`)으로 배포.

## 도구별 주소

도구마다 주소가 따로 있다: `/pomodoro`, `/study`, `/metronome`, `/clock`, `/flip`, `/classroom`. `/` 는 마지막에 쓴 도구를 여는 첫 화면.
`pomodoro.html` 같은 파일을 Workers 가 확장자 없는 주소로 내준다. 탭을 누르면 새로고침 없이 주소만 바뀌고(`assets/app.js`), 예전 `/#metronome` 주소는 `/metronome` 으로 바꿔 연다.

도구별 HTML 은 `index.html` 을 틀로 `scripts/pages.mjs` 가 만든다 (제목, 설명, canonical, JSON-LD, h1, 처음 열 탭, 사용 안내 순서만 바꿈).

**index.html 수정 후 `node scripts/pages.mjs` 실행.** 도구별 HTML 은 직접 고치지 말 것.

- 페이지 제목과 h1: `index.html` 탭 링크의 `data-title`, `data-h1` (app.js 도 같은 값을 씀)
- 설명과 JSON-LD: `scripts/pages.mjs` 안의 `pages`
- 주소를 더하거나 바꾸면 `sitemap.xml` 도 같이

## 로컬에서 보기

```
npx wrangler dev
```

`og.png`(1200×630), `apple-touch-icon.png`(180×180)는 공유 미리보기와 홈 화면 아이콘.
