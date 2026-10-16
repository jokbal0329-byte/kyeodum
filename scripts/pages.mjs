// 도구별 페이지 만들기: index.html 을 틀로 pomodoro.html, study.html ... 을 써 냄 (의존성 없음)
// index.html 을 고친 뒤 실행: node scripts/pages.mjs
// 페이지 제목과 h1 은 index.html 탭 링크의 data-title, data-h1 에서 가져옴 (app.js 도 같은 값을 씀)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SITE = 'https://kyeodum.ludlet.com';

// 설명은 70~160자, category 는 schema.org applicationCategory
const pages = {
  pomodoro: {
    name: '켜둠 뽀모도로 타이머',
    category: 'UtilitiesApplication',
    description: '무료 온라인 뽀모도로 타이머. 25분 집중하고 5분 쉬는 뽀모도로 기법을 설치 없이 바로 써 보세요. 집중·휴식 시간과 긴 휴식 간격을 바꿀 수 있고, 끝나면 알림음이 울려요.',
  },
  study: {
    name: '켜둠 공부 타이머',
    category: 'EducationalApplication',
    description: '과목별로 공부시간을 기록하는 무료 공부 타이머. 국어, 영어, 수학처럼 과목을 나눠 재고 오늘 공부한 총 시간을 바로 확인하세요. 기록은 이 브라우저에만 저장돼요.',
  },
  metronome: {
    name: '켜둠 온라인 메트로놈',
    category: 'UtilitiesApplication',
    description: '설치 없이 쓰는 무료 온라인 메트로놈. 30~250 BPM 사이에서 빠르기를 맞추고, 탭으로 곡의 템포를 재고, 2·3·4·6박과 첫 박 강조를 고를 수 있어요.',
  },
  clock: {
    name: '켜둠 전체화면 시계',
    category: 'UtilitiesApplication',
    description: '날짜와 요일, 시각을 화면 가득 크게 보여주는 무료 전체화면 시계. 24시간제와 초 표시를 고르고, 모니터나 태블릿에 켜두는 탁상시계로 쓰세요.',
  },
  flip: {
    name: '켜둠 플립 시계',
    category: 'UtilitiesApplication',
    description: '숫자 카드가 넘어가는 무료 온라인 플립 시계. 전체화면으로 띄워 보조 모니터, 공부 방송 배경, 매장 대기 화면의 탁상시계로 쓰세요. 24시간제와 초 표시 선택.',
  },
  classroom: {
    name: '켜둠 수업 타이머',
    category: 'EducationalApplication',
    description: '교실 TV나 프로젝터에 띄우는 무료 수업 타이머. 줄어드는 빨간 부채꼴로 남은 시간을 보여주고, 1~30분 빠른 설정과 끝날 때 알림음으로 모둠 활동과 시험 시간을 관리하세요.',
  },
};

const template = readFileSync(root + 'index.html', 'utf8');

// 틀이 바뀌어 못 찾으면 조용히 넘어가지 말고 멈춤
function sub(html, pattern, to, what) {
  const n = (html.match(new RegExp(pattern.source, 'g')) || []).length;
  if (n !== 1) throw new Error(`${what}: index.html 에서 ${n}번 찾음 (1번이어야 함)`);
  return html.replace(pattern, to);
}
const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

for (const [id, p] of Object.entries(pages)) {
  if (p.description.length < 70 || p.description.length > 160) throw new Error(`${id}: 설명 ${p.description.length}자`);
  const tab = template.match(new RegExp(`data-tool="${id}" data-title="([^"]+)" data-h1="([^"]+)"`));
  if (!tab) throw new Error(`${id}: 탭 링크의 data-title, data-h1 을 못 찾음`);
  const [, title, h1] = tab;
  const url = `${SITE}/${id}`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: p.name,
    url,
    description: p.description,
    applicationCategory: p.category,
    operatingSystem: 'Any',
    inLanguage: 'ko',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
    publisher: { '@type': 'Organization', name: 'ludlet', url: 'https://ludlet.com' },
  };

  let h = template;
  h = sub(h, /<!-- 도구별 페이지\(pomodoro\.html 등\)는[^>]*-->/, '<!-- 이 파일은 scripts/pages.mjs 가 index.html 로 만든 것: 직접 고치지 말고 index.html 수정 후 node scripts/pages.mjs -->', '안내 주석');
  h = sub(h, /<title>[^<]*<\/title>/, `<title>${title}</title>`, 'title');
  h = sub(h, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr(p.description)}">`, 'description');
  h = sub(h, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`, 'canonical');
  h = sub(h, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`, 'og:url');
  h = sub(h, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${attr(title)}">`, 'og:title');
  h = sub(h, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${attr(p.description)}">`, 'og:description');
  h = sub(h, /<script type="application\/ld\+json">\n[^\n]*\n<\/script>/, `<script type="application/ld+json">\n${JSON.stringify(ld).replace(/</g, '\\u003c')}\n</script>`, 'JSON-LD');
  h = sub(h, /<h1 class="intro">[^<]*<\/h1>/, `<h1 class="intro">${h1}</h1>`, 'h1');
  // 처음부터 이 도구의 탭과 화면이 열린 상태로 (스크립트 전에도, 검색엔진에도)
  h = sub(h, new RegExp(`(<a href="/${id}" role="tab")`), '$1 aria-selected="true"', '탭');
  h = sub(h, new RegExp(`(<section class="tool" id="tool-${id}"[^>]*?) hidden>`), '$1>', '도구 화면');
  // 사용 안내: 이 도구의 글을 맨 앞으로
  h = sub(h, /(<p class="lead">[^\n]*\n\n)((?:      <article data-tool="[a-z]+">[\s\S]*?<\/article>\n\n?)+)/, (_, lead, list) => {
    const arts = list.match(/      <article data-tool="[a-z]+">[\s\S]*?<\/article>/g);
    const mine = arts.find((a) => a.includes(`data-tool="${id}"`));
    if (!mine) throw new Error(`${id}: 사용 안내 글을 못 찾음`);
    return lead + [mine, ...arts.filter((a) => a !== mine)].join('\n\n') + '\n';
  }, '사용 안내');

  writeFileSync(`${root}${id}.html`, h);
  console.log(`${id}.html  ${title}`);
}
