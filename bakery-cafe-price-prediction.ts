/**
 * 빵집·카페 사장님 원자재 가격 예측 리포트
 *
 * 수학 모델 6종을 활용한 단기/장기 가격 예측 + 매입 신호 생성
 * 순수 TypeScript — 외부 라이브러리 없이 실행 가능
 *
 * 실행: npx tsx src/bakery-cafe-price-prediction.ts
 */

// ════════════════════════════════════════════════════════════════
// 1. 타입 정의
// ════════════════════════════════════════════════════════════════

interface DailyPrice {
  date: string;
  intlPrice: number;
  intlUnit: string;
  domesticLow: number;
  domesticHigh: number;
  domesticUnit: string;
}

interface IngredientReport {
  name: string;
  nameEn: string;
  icon: string;
  trend: "상승" | "하락" | "보합";
  trendPct: string;
  keyFactor: string;
  dailyPrices: DailyPrice[];
}

// ── 예측 결과 타입 ─────────────────────────────────────────────

interface LinearRegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  standardError: number;
  equation: string;
}

interface EMAResult {
  shortEMA: number[];
  longEMA: number[];
  currentShort: number;
  currentLong: number;
  crossoverSignal: "BULLISH" | "BEARISH" | "NEUTRAL";
  equation: string;
}

interface VolatilityResult {
  dailyReturns: number[];
  stdDev: number;
  annualizedVol: number;
  riskScore: number;
  equation: string;
}

interface RSIResult {
  rsi: number;
  avgGain: number;
  avgLoss: number;
  signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  equation: string;
}

interface SeasonalResult {
  dayOfWeekEffects: Record<string, number>;
  equation: string;
}

interface PredictionPoint {
  daysAhead: number;
  predicted: number;
  low: number;
  high: number;
  confidence: number;
}

interface ModelResult {
  modelName: string;
  equation: string;
  prediction: number;
  confidence: number;
}

interface PriceAlert {
  ingredient: string;
  ingredientEn: string;
  icon: string;
  signal: "BUY_NOW" | "WAIT" | "URGENT_BUY" | "HOLD";
  signalKo: string;
  confidence: number;
  currentPrice: { low: number; high: number };
  predictedPrice7d: { low: number; high: number };
  predictedPrice30d: { low: number; high: number };
  reason: string;
  models: ModelResult[];
  predictions: PredictionPoint[];
  riskScore: number;
}

// ════════════════════════════════════════════════════════════════
// 2. 원자재 데이터 (기존 대시보드에서 복사)
// ════════════════════════════════════════════════════════════════

const KRW_PER_USD = 1_441;

const ingredients: IngredientReport[] = [
  {
    name: "밀가루 (박력분)", nameEn: "Wheat Flour", icon: "🌾",
    trend: "하락", trendPct: "-4.0%",
    keyFactor: "CJ·삼양 B2B 4% 인하 + 국제 밀 선물 약세",
    dailyPrices: [
      { date: "2026-02-13", intlPrice: 5.53, intlUnit: "$/bu", domesticLow: 780, domesticHigh: 870, domesticUnit: "원/kg" },
      { date: "2026-02-14", intlPrice: 5.50, intlUnit: "$/bu", domesticLow: 775, domesticHigh: 865, domesticUnit: "원/kg" },
      { date: "2026-02-15", intlPrice: 5.50, intlUnit: "$/bu", domesticLow: 775, domesticHigh: 865, domesticUnit: "원/kg" },
      { date: "2026-02-16", intlPrice: 5.50, intlUnit: "$/bu", domesticLow: 775, domesticHigh: 865, domesticUnit: "원/kg" },
      { date: "2026-02-17", intlPrice: 5.48, intlUnit: "$/bu", domesticLow: 770, domesticHigh: 860, domesticUnit: "원/kg" },
      { date: "2026-02-18", intlPrice: 5.47, intlUnit: "$/bu", domesticLow: 750, domesticHigh: 855, domesticUnit: "원/kg" },
      { date: "2026-02-19", intlPrice: 5.45, intlUnit: "$/bu", domesticLow: 750, domesticHigh: 850, domesticUnit: "원/kg" },
    ],
  },
  {
    name: "설탕 (백설탕)", nameEn: "Sugar", icon: "🍬",
    trend: "하락", trendPct: "-6.0%",
    keyFactor: "글로벌 8.3백만톤 과잉 + 원당 5년래 최저",
    dailyPrices: [
      { date: "2026-02-13", intlPrice: 0.142, intlUnit: "$/lb", domesticLow: 850, domesticHigh: 1020, domesticUnit: "원/kg" },
      { date: "2026-02-14", intlPrice: 0.141, intlUnit: "$/lb", domesticLow: 845, domesticHigh: 1015, domesticUnit: "원/kg" },
      { date: "2026-02-15", intlPrice: 0.141, intlUnit: "$/lb", domesticLow: 845, domesticHigh: 1015, domesticUnit: "원/kg" },
      { date: "2026-02-16", intlPrice: 0.141, intlUnit: "$/lb", domesticLow: 845, domesticHigh: 1015, domesticUnit: "원/kg" },
      { date: "2026-02-17", intlPrice: 0.140, intlUnit: "$/lb", domesticLow: 830, domesticHigh: 1005, domesticUnit: "원/kg" },
      { date: "2026-02-18", intlPrice: 0.138, intlUnit: "$/lb", domesticLow: 810, domesticHigh: 1000, domesticUnit: "원/kg" },
      { date: "2026-02-19", intlPrice: 0.137, intlUnit: "$/lb", domesticLow: 800, domesticHigh: 990, domesticUnit: "원/kg" },
    ],
  },
  {
    name: "무염버터", nameEn: "Butter (Unsalted)", icon: "🧈",
    trend: "보합", trendPct: "+1.2%",
    keyFactor: "유럽 시세 반등 중이나 국내 원유 가격 고정",
    dailyPrices: [
      { date: "2026-02-13", intlPrice: 4.48, intlUnit: "$/kg", domesticLow: 15300, domesticHigh: 17500, domesticUnit: "원/kg" },
      { date: "2026-02-14", intlPrice: 4.50, intlUnit: "$/kg", domesticLow: 15300, domesticHigh: 17500, domesticUnit: "원/kg" },
      { date: "2026-02-15", intlPrice: 4.50, intlUnit: "$/kg", domesticLow: 15300, domesticHigh: 17500, domesticUnit: "원/kg" },
      { date: "2026-02-16", intlPrice: 4.50, intlUnit: "$/kg", domesticLow: 15300, domesticHigh: 17500, domesticUnit: "원/kg" },
      { date: "2026-02-17", intlPrice: 4.51, intlUnit: "$/kg", domesticLow: 15400, domesticHigh: 17600, domesticUnit: "원/kg" },
      { date: "2026-02-18", intlPrice: 4.52, intlUnit: "$/kg", domesticLow: 15500, domesticHigh: 17800, domesticUnit: "원/kg" },
      { date: "2026-02-19", intlPrice: 4.53, intlUnit: "$/kg", domesticLow: 15500, domesticHigh: 17800, domesticUnit: "원/kg" },
    ],
  },
  {
    name: "계란 (특란)", nameEn: "Eggs (Extra-Large)", icon: "🥚",
    trend: "보합", trendPct: "-1.5%",
    keyFactor: "조류인플루엔자 살처분 431만수 vs 전년比 -8.4%",
    dailyPrices: [
      { date: "2026-02-13", intlPrice: 5.57, intlUnit: "$/dz", domesticLow: 5600, domesticHigh: 6500, domesticUnit: "원/30구" },
      { date: "2026-02-14", intlPrice: 5.55, intlUnit: "$/dz", domesticLow: 5600, domesticHigh: 6500, domesticUnit: "원/30구" },
      { date: "2026-02-15", intlPrice: 5.55, intlUnit: "$/dz", domesticLow: 5600, domesticHigh: 6500, domesticUnit: "원/30구" },
      { date: "2026-02-16", intlPrice: 5.55, intlUnit: "$/dz", domesticLow: 5600, domesticHigh: 6500, domesticUnit: "원/30구" },
      { date: "2026-02-17", intlPrice: 5.52, intlUnit: "$/dz", domesticLow: 5550, domesticHigh: 6450, domesticUnit: "원/30구" },
      { date: "2026-02-18", intlPrice: 5.50, intlUnit: "$/dz", domesticLow: 5500, domesticHigh: 6400, domesticUnit: "원/30구" },
      { date: "2026-02-19", intlPrice: 5.48, intlUnit: "$/dz", domesticLow: 5500, domesticHigh: 6400, domesticUnit: "원/30구" },
    ],
  },
  {
    name: "우유 (신선)", nameEn: "Fresh Milk", icon: "🥛",
    trend: "하락", trendPct: "-2.0%",
    keyFactor: "2026 FTA 관세 철폐 → 수입산 압박",
    dailyPrices: [
      { date: "2026-02-13", intlPrice: 0.33, intlUnit: "$/L", domesticLow: 1850, domesticHigh: 2250, domesticUnit: "원/L" },
      { date: "2026-02-14", intlPrice: 0.33, intlUnit: "$/L", domesticLow: 1850, domesticHigh: 2250, domesticUnit: "원/L" },
      { date: "2026-02-15", intlPrice: 0.33, intlUnit: "$/L", domesticLow: 1850, domesticHigh: 2250, domesticUnit: "원/L" },
      { date: "2026-02-16", intlPrice: 0.33, intlUnit: "$/L", domesticLow: 1850, domesticHigh: 2250, domesticUnit: "원/L" },
      { date: "2026-02-17", intlPrice: 0.33, intlUnit: "$/L", domesticLow: 1830, domesticHigh: 2230, domesticUnit: "원/L" },
      { date: "2026-02-18", intlPrice: 0.32, intlUnit: "$/L", domesticLow: 1800, domesticHigh: 2200, domesticUnit: "원/L" },
      { date: "2026-02-19", intlPrice: 0.32, intlUnit: "$/L", domesticLow: 1800, domesticHigh: 2200, domesticUnit: "원/L" },
    ],
  },
  {
    name: "생크림", nameEn: "Fresh Cream", icon: "🍦",
    trend: "보합", trendPct: "+0.5%",
    keyFactor: "국내 원유 가격(1,051원/kg) 고정에 연동",
    dailyPrices: [
      { date: "2026-02-13", intlPrice: 3.80, intlUnit: "$/kg", domesticLow: 8200, domesticHigh: 12000, domesticUnit: "원/L" },
      { date: "2026-02-14", intlPrice: 3.80, intlUnit: "$/kg", domesticLow: 8200, domesticHigh: 12000, domesticUnit: "원/L" },
      { date: "2026-02-15", intlPrice: 3.80, intlUnit: "$/kg", domesticLow: 8200, domesticHigh: 12000, domesticUnit: "원/L" },
      { date: "2026-02-16", intlPrice: 3.80, intlUnit: "$/kg", domesticLow: 8200, domesticHigh: 12000, domesticUnit: "원/L" },
      { date: "2026-02-17", intlPrice: 3.82, intlUnit: "$/kg", domesticLow: 8200, domesticHigh: 12100, domesticUnit: "원/L" },
      { date: "2026-02-18", intlPrice: 3.83, intlUnit: "$/kg", domesticLow: 8200, domesticHigh: 12100, domesticUnit: "원/L" },
      { date: "2026-02-19", intlPrice: 3.83, intlUnit: "$/kg", domesticLow: 8000, domesticHigh: 12000, domesticUnit: "원/L" },
    ],
  },
  {
    name: "커버춰 초콜릿 (다크)", nameEn: "Couverture Chocolate", icon: "🍫",
    trend: "하락", trendPct: "-30.6%",
    keyFactor: "카카오 선물 $4,000 하회, 28.7만톤 과잉",
    dailyPrices: [
      { date: "2026-02-13", intlPrice: 3900, intlUnit: "$/톤", domesticLow: 16000, domesticHigh: 25000, domesticUnit: "원/kg" },
      { date: "2026-02-14", intlPrice: 3850, intlUnit: "$/톤", domesticLow: 16000, domesticHigh: 25000, domesticUnit: "원/kg" },
      { date: "2026-02-15", intlPrice: 3850, intlUnit: "$/톤", domesticLow: 16000, domesticHigh: 25000, domesticUnit: "원/kg" },
      { date: "2026-02-16", intlPrice: 3850, intlUnit: "$/톤", domesticLow: 16000, domesticHigh: 25000, domesticUnit: "원/kg" },
      { date: "2026-02-17", intlPrice: 3600, intlUnit: "$/톤", domesticLow: 15500, domesticHigh: 24500, domesticUnit: "원/kg" },
      { date: "2026-02-18", intlPrice: 3415, intlUnit: "$/톤", domesticLow: 15000, domesticHigh: 24000, domesticUnit: "원/kg" },
      { date: "2026-02-19", intlPrice: 3400, intlUnit: "$/톤", domesticLow: 15000, domesticHigh: 24000, domesticUnit: "원/kg" },
    ],
  },
  {
    name: "커피 원두 (아라비카)", nameEn: "Coffee Beans (Arabica)", icon: "☕",
    trend: "하락", trendPct: "-17.4%",
    keyFactor: "브라질 2026년 역대 최대 6,620만 백 생산 전망",
    dailyPrices: [
      { date: "2026-02-13", intlPrice: 6.80, intlUnit: "$/kg", domesticLow: 9800, domesticHigh: 25000, domesticUnit: "원/kg" },
      { date: "2026-02-14", intlPrice: 6.75, intlUnit: "$/kg", domesticLow: 9700, domesticHigh: 24800, domesticUnit: "원/kg" },
      { date: "2026-02-15", intlPrice: 6.75, intlUnit: "$/kg", domesticLow: 9700, domesticHigh: 24800, domesticUnit: "원/kg" },
      { date: "2026-02-16", intlPrice: 6.75, intlUnit: "$/kg", domesticLow: 9700, domesticHigh: 24800, domesticUnit: "원/kg" },
      { date: "2026-02-17", intlPrice: 6.60, intlUnit: "$/kg", domesticLow: 9500, domesticHigh: 24500, domesticUnit: "원/kg" },
      { date: "2026-02-18", intlPrice: 6.48, intlUnit: "$/kg", domesticLow: 9300, domesticHigh: 24200, domesticUnit: "원/kg" },
      { date: "2026-02-19", intlPrice: 6.45, intlUnit: "$/kg", domesticLow: 9300, domesticHigh: 24000, domesticUnit: "원/kg" },
    ],
  },
  {
    name: "바닐라 (익스트랙트/빈)", nameEn: "Vanilla", icon: "🌿",
    trend: "보합", trendPct: "+0.8%",
    keyFactor: "마다가스카르 개화율 42% 역대 최저",
    dailyPrices: [
      { date: "2026-02-13", intlPrice: 450, intlUnit: "$/kg", domesticLow: 15000, domesticHigh: 30000, domesticUnit: "원/병" },
      { date: "2026-02-14", intlPrice: 450, intlUnit: "$/kg", domesticLow: 15000, domesticHigh: 30000, domesticUnit: "원/병" },
      { date: "2026-02-15", intlPrice: 450, intlUnit: "$/kg", domesticLow: 15000, domesticHigh: 30000, domesticUnit: "원/병" },
      { date: "2026-02-16", intlPrice: 450, intlUnit: "$/kg", domesticLow: 15000, domesticHigh: 30000, domesticUnit: "원/병" },
      { date: "2026-02-17", intlPrice: 452, intlUnit: "$/kg", domesticLow: 15000, domesticHigh: 30200, domesticUnit: "원/병" },
      { date: "2026-02-18", intlPrice: 453, intlUnit: "$/kg", domesticLow: 15100, domesticHigh: 30500, domesticUnit: "원/병" },
      { date: "2026-02-19", intlPrice: 453, intlUnit: "$/kg", domesticLow: 15100, domesticHigh: 30500, domesticUnit: "원/병" },
    ],
  },
  {
    name: "아몬드 (분태/슬라이스)", nameEn: "Almonds", icon: "🌰",
    trend: "보합", trendPct: "+0.3%",
    keyFactor: "캘리포니아산 재고 저수준 + 45% 기본관세",
    dailyPrices: [
      { date: "2026-02-13", intlPrice: 5.90, intlUnit: "$/kg", domesticLow: 15500, domesticHigh: 22000, domesticUnit: "원/kg" },
      { date: "2026-02-14", intlPrice: 5.92, intlUnit: "$/kg", domesticLow: 15500, domesticHigh: 22000, domesticUnit: "원/kg" },
      { date: "2026-02-15", intlPrice: 5.92, intlUnit: "$/kg", domesticLow: 15500, domesticHigh: 22000, domesticUnit: "원/kg" },
      { date: "2026-02-16", intlPrice: 5.92, intlUnit: "$/kg", domesticLow: 15500, domesticHigh: 22000, domesticUnit: "원/kg" },
      { date: "2026-02-17", intlPrice: 5.95, intlUnit: "$/kg", domesticLow: 15600, domesticHigh: 22100, domesticUnit: "원/kg" },
      { date: "2026-02-18", intlPrice: 5.98, intlUnit: "$/kg", domesticLow: 15700, domesticHigh: 22200, domesticUnit: "원/kg" },
      { date: "2026-02-19", intlPrice: 6.00, intlUnit: "$/kg", domesticLow: 15700, domesticHigh: 22200, domesticUnit: "원/kg" },
    ],
  },
];

// ════════════════════════════════════════════════════════════════
// 3. 유틸리티 함수
// ════════════════════════════════════════════════════════════════

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("ko-KR");
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function signalEmoji(s: PriceAlert["signal"]): string {
  return { BUY_NOW: "🟢", WAIT: "⚪", URGENT_BUY: "🔴", HOLD: "🟡" }[s];
}

function signalKo(s: PriceAlert["signal"]): string {
  return { BUY_NOW: "매수적기", WAIT: "대기", URGENT_BUY: "긴급매수", HOLD: "보류" }[s];
}

function riskKo(score: number): string {
  if (score < 20) return "낮음";
  if (score < 50) return "중간";
  if (score < 80) return "높음";
  return "매우높음";
}

/** 국내 평균가 배열 추출 */
function avgPrices(ing: IngredientReport): number[] {
  return ing.dailyPrices.map(d => (d.domesticLow + d.domesticHigh) / 2);
}

// ════════════════════════════════════════════════════════════════
// 4. 수학 모델 구현
// ════════════════════════════════════════════════════════════════

/**
 * ━━━ 모델 1: 선형회귀 (최소제곱법 / OLS) ━━━
 *
 *   y = ax + b
 *
 *       Σ(x_i - x̄)(y_i - ȳ)
 *   a = ─────────────────────
 *          Σ(x_i - x̄)²
 *
 *   b = ȳ - a·x̄
 *
 *              SS_res
 *   R² = 1 - ───────
 *              SS_tot
 *
 *   SE = √(SS_res / (n - 2))
 */
function calculateLinearRegression(prices: number[]): LinearRegressionResult {
  const n = prices.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const xBar = mean(xs);
  const yBar = mean(prices);

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (xs[i] - xBar) * (prices[i] - yBar);
    denominator += (xs[i] - xBar) ** 2;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yBar - slope * xBar;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i] + intercept;
    ssRes += (prices[i] - predicted) ** 2;
    ssTot += (prices[i] - yBar) ** 2;
  }

  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  const standardError = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;

  return {
    slope,
    intercept,
    rSquared,
    standardError,
    equation: `y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}`,
  };
}

/**
 * ━━━ 모델 2: 지수이동평균 (EMA) ━━━
 *
 *            2
 *   α = ─────────
 *        period + 1
 *
 *   EMA_t = α · P_t + (1 - α) · EMA_{t-1}
 *
 *   EMA_0 = P_0  (초기값 = 첫째 날 가격)
 *
 *   교차 판정:
 *     단기 EMA < 장기 EMA → BEARISH (하락 신호)
 *     단기 EMA > 장기 EMA → BULLISH (상승 신호)
 */
function calculateEMA(prices: number[], period: number): number[] {
  const alpha = 2 / (period + 1);
  const ema: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(alpha * prices[i] + (1 - alpha) * ema[i - 1]);
  }
  return ema;
}

function analyzeEMA(prices: number[]): EMAResult {
  const shortPeriod = 3;
  const longPeriod = 7;
  const alphaShort = 2 / (shortPeriod + 1); // 0.5
  const alphaLong = 2 / (longPeriod + 1);   // 0.25

  const shortEMA = calculateEMA(prices, shortPeriod);
  const longEMA = calculateEMA(prices, longPeriod);

  const currentShort = shortEMA[shortEMA.length - 1];
  const currentLong = longEMA[longEMA.length - 1];
  const prevShort = shortEMA.length > 1 ? shortEMA[shortEMA.length - 2] : currentShort;
  const prevLong = longEMA.length > 1 ? longEMA[longEMA.length - 2] : currentLong;

  let crossoverSignal: EMAResult["crossoverSignal"] = "NEUTRAL";
  if (prevShort <= prevLong && currentShort > currentLong) crossoverSignal = "BULLISH";
  else if (prevShort >= prevLong && currentShort < currentLong) crossoverSignal = "BEARISH";
  else if (currentShort < currentLong) crossoverSignal = "BEARISH";
  else if (currentShort > currentLong) crossoverSignal = "BULLISH";

  return {
    shortEMA, longEMA, currentShort, currentLong, crossoverSignal,
    equation: `EMA_3 = ${alphaShort} * P_t + ${1 - alphaShort} * EMA_{t-1}\nEMA_7 = ${alphaLong} * P_t + ${1 - alphaLong} * EMA_{t-1}`,
  };
}

/**
 * ━━━ 모델 3: 가격 외삽 (Linear Extrapolation) ━━━
 *
 *   P(t + d) = a · (n - 1 + d) + b
 *
 *   95% 신뢰구간:
 *
 *                                   ┌          (x_new - x̄)²  ┐
 *   CI = P ± 1.96 · SE · √ │ 1 + 1/n + ──────────── │
 *                                   │          Σ(x_i - x̄)²   │
 *                                   └                         ┘
 */
function extrapolatePrice(
  prices: number[],
  daysAhead: number,
  reg: LinearRegressionResult,
): PredictionPoint {
  const n = prices.length;
  const xNew = n - 1 + daysAhead;
  const predicted = reg.slope * xNew + reg.intercept;

  const xs = Array.from({ length: n }, (_, i) => i);
  const xBar = mean(xs);
  const ssX = xs.reduce((s, x) => s + (x - xBar) ** 2, 0);

  const marginFactor = Math.sqrt(1 + 1 / n + (xNew - xBar) ** 2 / (ssX || 1));
  const margin = 1.96 * reg.standardError * marginFactor;

  // 신뢰도: 7일 데이터 기반이므로 멀수록 급격히 감소
  const confidence = Math.max(5, Math.round(100 * Math.exp(-0.08 * daysAhead)));

  return {
    daysAhead,
    predicted: Math.max(0, predicted),
    low: Math.max(0, predicted - margin),
    high: predicted + margin,
    confidence,
  };
}

/**
 * ━━━ 모델 4: 변동성 분석 ━━━
 *
 *   일별 수익률:
 *         P_i - P_{i-1}
 *   r_i = ─────────────
 *            P_{i-1}
 *
 *   표준편차:
 *              ┌ Σ(r_i - r̄)²  ┐
 *   σ = √ │ ──────────── │
 *              └    N - 1      ┘
 *
 *   연환산 변동성:
 *   σ_annual = σ · √252
 *
 *   위험점수 = min(100, σ × 1000)
 */
function calculateVolatility(prices: number[]): VolatilityResult {
  const dailyReturns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    dailyReturns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }

  const meanReturn = mean(dailyReturns);
  const variance = dailyReturns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / Math.max(1, dailyReturns.length - 1);
  const stdDev = Math.sqrt(variance);
  const annualizedVol = stdDev * Math.sqrt(252);
  const riskScore = Math.min(100, Math.round(stdDev * 1000));

  return {
    dailyReturns,
    stdDev,
    annualizedVol,
    riskScore,
    equation: `sigma = sqrt(sum((r_i - r_bar)^2) / (N-1)) = ${(stdDev * 100).toFixed(4)}%`,
  };
}

/**
 * ━━━ 모델 5: RSI 모멘텀 지표 ━━━
 *
 *               100
 *   RSI = 100 - ─────
 *               1 + RS
 *
 *        평균 상승폭
 *   RS = ──────────
 *        평균 하락폭
 *
 *   RSI > 70 → 과매수 (OVERBOUGHT): 가격 하락 예상 → 대기
 *   RSI < 30 → 과매도 (OVERSOLD): 가격 상승 반전 가능 → 저점 매수
 *   30~70   → 중립 (NEUTRAL)
 */
function calculateRSI(prices: number[]): RSIResult {
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  const gains = changes.map(c => (c > 0 ? c : 0));
  const losses = changes.map(c => (c < 0 ? Math.abs(c) : 0));

  const avgGain = mean(gains);
  const avgLoss = mean(losses);

  let rsi: number;
  if (avgLoss === 0) {
    rsi = avgGain === 0 ? 50 : 100;
  } else {
    const rs = avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);
  }

  let signal: RSIResult["signal"] = "NEUTRAL";
  if (rsi > 70) signal = "OVERBOUGHT";
  else if (rsi < 30) signal = "OVERSOLD";

  return {
    rsi,
    avgGain,
    avgLoss,
    signal,
    equation: `RSI = 100 - 100/(1 + RS); RS = AvgGain/AvgLoss = ${avgGain.toFixed(4)}/${avgLoss.toFixed(4)}`,
  };
}

/**
 * ━━━ 모델 6: 요일별 패턴 ━━━
 *
 *   Effect(요일) = mean(P_요일) - P_전체평균
 *
 *   양수 → 해당 요일에 가격이 평균보다 높음 (매수 불리)
 *   음수 → 해당 요일에 가격이 평균보다 낮음 (매수 유리)
 */
function calculateSeasonalPattern(dailyPrices: DailyPrice[]): SeasonalResult {
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dayPrices: Record<string, number[]> = {};
  dayNames.forEach(d => (dayPrices[d] = []));

  const allPrices: number[] = [];
  for (const dp of dailyPrices) {
    const avg = (dp.domesticLow + dp.domesticHigh) / 2;
    const dow = dayNames[new Date(dp.date).getDay()];
    dayPrices[dow].push(avg);
    allPrices.push(avg);
  }

  const overallMean = mean(allPrices);
  const effects: Record<string, number> = {};

  for (const day of dayNames) {
    if (dayPrices[day].length > 0) {
      effects[day] = mean(dayPrices[day]) - overallMean;
    }
  }

  return {
    dayOfWeekEffects: effects,
    equation: `Effect(요일) = mean(P_요일) - P_전체(${fmt(overallMean)})`,
  };
}

// ════════════════════════════════════════════════════════════════
// 5. 종합 신호 엔진
// ════════════════════════════════════════════════════════════════

/**
 * ━━━ 가중 투표 모델 ━━━
 *
 *   buyScore  = Σ(w_i × buy_vote_i)
 *   waitScore = Σ(w_i × wait_vote_i)
 *
 *   가중치:
 *     선형회귀 = 0.25
 *     EMA교차  = 0.20
 *     RSI      = 0.25
 *     변동성   = 0.15
 *     기존추세 = 0.15
 *
 *   buyScore ≥ 0.70 → 긴급매수
 *   buyScore ≥ 0.50 → 매수적기
 *   waitScore ≥ 0.50 → 대기
 *   그 외            → 보류
 */
function generateAlert(
  ing: IngredientReport,
  reg: LinearRegressionResult,
  ema: EMAResult,
  vol: VolatilityResult,
  rsi: RSIResult,
  predictions: PredictionPoint[],
): PriceAlert {
  // 각 모델의 매수/대기 투표
  const votes = {
    regression: { buy: reg.slope < 0 ? 1 : 0, wait: reg.slope > 0 ? 1 : 0, weight: 0.25 },
    ema:        { buy: ema.crossoverSignal === "BEARISH" ? 1 : 0, wait: ema.crossoverSignal === "BULLISH" ? 1 : 0, weight: 0.20 },
    rsi:        { buy: rsi.rsi < 30 ? 1 : (rsi.rsi < 50 ? 0.5 : 0), wait: rsi.rsi > 70 ? 1 : (rsi.rsi > 50 ? 0.5 : 0), weight: 0.25 },
    volatility: { buy: vol.riskScore < 30 && reg.slope < 0 ? 1 : 0, wait: vol.riskScore > 60 ? 1 : 0, weight: 0.15 },
    trend:      { buy: ing.trend === "하락" ? 1 : 0, wait: ing.trend === "상승" ? 1 : 0, weight: 0.15 },
  };

  let buyScore = 0;
  let waitScore = 0;
  for (const v of Object.values(votes)) {
    buyScore += v.weight * v.buy;
    waitScore += v.weight * v.wait;
  }

  let signal: PriceAlert["signal"];
  if (buyScore >= 0.70) signal = "URGENT_BUY";
  else if (buyScore >= 0.50) signal = "BUY_NOW";
  else if (waitScore >= 0.50) signal = "WAIT";
  else signal = "HOLD";

  const confidence = Math.round(Math.max(buyScore, waitScore) * 100);

  const reasons: string[] = [];
  if (reg.slope < 0) reasons.push(`회귀 기울기 ${reg.slope.toFixed(2)} (하락)`);
  if (ema.crossoverSignal === "BEARISH") reasons.push("EMA 하락 교차");
  if (rsi.rsi < 30) reasons.push(`RSI ${rsi.rsi.toFixed(0)} 과매도`);
  if (rsi.rsi > 70) reasons.push(`RSI ${rsi.rsi.toFixed(0)} 과매수`);
  if (vol.riskScore < 20) reasons.push("변동성 낮음(안정)");
  if (vol.riskScore > 60) reasons.push("변동성 높음(불안)");
  reasons.push(ing.keyFactor);

  const latest = ing.dailyPrices[ing.dailyPrices.length - 1];
  const pred7 = predictions.find(p => p.daysAhead === 7)!;
  const pred30 = predictions.find(p => p.daysAhead === 30)!;

  const models: ModelResult[] = [
    { modelName: "선형회귀", equation: reg.equation, prediction: reg.slope * (ing.dailyPrices.length + 6) + reg.intercept, confidence: Math.round(reg.rSquared * 100) },
    { modelName: "EMA교차", equation: ema.equation.split("\n")[0], prediction: ema.currentShort, confidence: 70 },
    { modelName: "RSI", equation: `RSI = ${rsi.rsi.toFixed(1)}`, prediction: rsi.rsi, confidence: 75 },
    { modelName: "변동성", equation: vol.equation, prediction: vol.riskScore, confidence: 80 },
  ];

  return {
    ingredient: ing.name,
    ingredientEn: ing.nameEn,
    icon: ing.icon,
    signal,
    signalKo: signalKo(signal),
    confidence,
    currentPrice: { low: latest.domesticLow, high: latest.domesticHigh },
    predictedPrice7d: { low: Math.round(pred7.low), high: Math.round(pred7.high) },
    predictedPrice30d: { low: Math.round(pred30.low), high: Math.round(pred30.high) },
    reason: reasons.join(" | "),
    models,
    predictions,
    riskScore: vol.riskScore,
  };
}

function analyzeIngredient(ing: IngredientReport): PriceAlert {
  const prices = avgPrices(ing);

  const reg = calculateLinearRegression(prices);
  const ema = analyzeEMA(prices);
  const vol = calculateVolatility(prices);
  const rsi = calculateRSI(prices);

  const predictions = [1, 3, 7, 14, 30].map(d => extrapolatePrice(prices, d, reg));

  return generateAlert(ing, reg, ema, vol, rsi, predictions);
}

function analyzeAll(): { alerts: PriceAlert[]; details: Map<string, { reg: LinearRegressionResult; ema: EMAResult; vol: VolatilityResult; rsi: RSIResult; seasonal: SeasonalResult; predictions: PredictionPoint[] }> } {
  const alerts: PriceAlert[] = [];
  const details = new Map<string, { reg: LinearRegressionResult; ema: EMAResult; vol: VolatilityResult; rsi: RSIResult; seasonal: SeasonalResult; predictions: PredictionPoint[] }>();

  for (const ing of ingredients) {
    const prices = avgPrices(ing);
    const reg = calculateLinearRegression(prices);
    const ema = analyzeEMA(prices);
    const vol = calculateVolatility(prices);
    const rsi = calculateRSI(prices);
    const seasonal = calculateSeasonalPattern(ing.dailyPrices);
    const predictions = [1, 3, 7, 14, 30].map(d => extrapolatePrice(prices, d, reg));

    details.set(ing.name, { reg, ema, vol, rsi, seasonal, predictions });
    alerts.push(generateAlert(ing, reg, ema, vol, rsi, predictions));
  }

  // 긴급도 순 정렬
  const order: Record<string, number> = { URGENT_BUY: 0, BUY_NOW: 1, HOLD: 2, WAIT: 3 };
  alerts.sort((a, b) => order[a.signal] - order[b.signal]);

  return { alerts, details };
}

// ════════════════════════════════════════════════════════════════
// 6. 출력 렌더러
// ════════════════════════════════════════════════════════════════

const LINE = "═".repeat(78);
const THIN = "─".repeat(78);

function printHeader() {
  console.log(`\n${LINE}`);
  console.log("  🔮 빵집·카페 원자재 가격 예측 리포트");
  console.log(`  📅 데이터 기간: 2026-02-13 ~ 2026-02-19 (7일)`);
  console.log(`  🕐 예측 생성: ${new Date().toLocaleString("ko-KR")}`);
  console.log(`  📐 적용 모델: 선형회귀 | EMA | 외삽 | 변동성 | RSI | 계절성`);
  console.log(`  💱 환율: 1 USD = ${fmt(KRW_PER_USD)} KRW`);
  console.log(LINE);
}

function printIngredientAnalysis(
  ing: IngredientReport,
  d: { reg: LinearRegressionResult; ema: EMAResult; vol: VolatilityResult; rsi: RSIResult; seasonal: SeasonalResult; predictions: PredictionPoint[] },
  alert: PriceAlert,
) {
  const prices = avgPrices(ing);

  console.log(`\n${LINE}`);
  console.log(`  ${ing.icon} ${ing.name} (${ing.nameEn})`);
  console.log(LINE);

  // ── 모델 1: 선형회귀 ──
  console.log(`\n  📐 모델 1: 선형회귀 (최소제곱법 / OLS)`);
  console.log(`  ${THIN}`);
  console.log(`  수식: ${d.reg.equation}`);
  console.log(`  기울기(a) = ${d.reg.slope.toFixed(4)}  (매일 ${Math.abs(d.reg.slope).toFixed(2)}원씩 ${d.reg.slope < 0 ? "하락" : "상승"})`);
  console.log(`  절편(b) = ${d.reg.intercept.toFixed(2)}`);
  console.log(`  결정계수(R²) = ${d.reg.rSquared.toFixed(4)}  (적합도 ${(d.reg.rSquared * 100).toFixed(1)}%)`);
  console.log(`  표준오차(SE) = ${d.reg.standardError.toFixed(4)}`);

  // ── 모델 2: EMA ──
  console.log(`\n  📐 모델 2: 지수이동평균 (EMA)`);
  console.log(`  ${THIN}`);
  console.log(`  단기 EMA(3일): alpha = 0.50`);
  console.log(`    수식: EMA_t = 0.50 × P_t + 0.50 × EMA_{t-1}`);
  console.log(`    현재값: ${d.ema.currentShort.toFixed(2)}`);
  console.log(`  장기 EMA(7일): alpha = 0.25`);
  console.log(`    수식: EMA_t = 0.25 × P_t + 0.75 × EMA_{t-1}`);
  console.log(`    현재값: ${d.ema.currentLong.toFixed(2)}`);
  const emaSignalText = d.ema.crossoverSignal === "BEARISH" ? "📉 하락 신호" : d.ema.crossoverSignal === "BULLISH" ? "📈 상승 신호" : "➡️ 중립";
  console.log(`  교차 신호: 단기 ${d.ema.currentShort < d.ema.currentLong ? "<" : ">"} 장기 → ${emaSignalText}`);

  // ── 모델 3: 가격 외삽 ──
  console.log(`\n  📐 모델 3: 가격 외삽 (선형 추세 투영)`);
  console.log(`  ${THIN}`);
  console.log(`  수식: P(t+d) = ${d.reg.slope.toFixed(2)} × (${prices.length - 1}+d) + ${d.reg.intercept.toFixed(2)}`);
  console.log(`  신뢰구간: CI = P ± 1.96 × SE × √(1 + 1/n + (x-x̄)²/Σ(x_i-x̄)²)`);
  console.log(`  ┌────────┬──────────┬──────────────────────┬──────────┐`);
  console.log(`  │ 기간   │ 예측가격 │ 95% 신뢰구간         │ 신뢰도   │`);
  console.log(`  ├────────┼──────────┼──────────────────────┼──────────┤`);
  for (const p of d.predictions) {
    const label = `+${p.daysAhead}일`.padEnd(6);
    console.log(`  │ ${label} │ ${fmt(p.predicted).padStart(8)} │ ${fmt(p.low).padStart(8)} ~ ${fmt(p.high).padEnd(8)} │ ${(p.confidence + "%").padStart(6)}   │`);
  }
  console.log(`  └────────┴──────────┴──────────────────────┴──────────┘`);
  if (d.predictions.some(p => p.daysAhead >= 14)) {
    console.log(`  ⚠️  14일 이상 예측은 참고용 (데이터 7일분 한계)`);
  }

  // ── 모델 4: 변동성 ──
  console.log(`\n  📐 모델 4: 변동성 분석`);
  console.log(`  ${THIN}`);
  console.log(`  수식: sigma = sqrt(sum((r_i - r_bar)^2) / (N-1))`);
  console.log(`  일별 수익률: [${d.vol.dailyReturns.map(r => (r * 100).toFixed(2) + "%").join(", ")}]`);
  console.log(`  표준편차(sigma): ${(d.vol.stdDev * 100).toFixed(4)}%`);
  console.log(`  연환산 변동성: ${(d.vol.annualizedVol * 100).toFixed(2)}%`);
  console.log(`  위험 점수: ${d.vol.riskScore}/100 (${riskKo(d.vol.riskScore)} ${d.vol.riskScore < 30 ? "✅" : d.vol.riskScore < 60 ? "⚠️" : "🚨"})`);

  // ── 모델 5: RSI ──
  console.log(`\n  📐 모델 5: RSI 모멘텀 지표 (6일 기간)`);
  console.log(`  ${THIN}`);
  console.log(`  수식: RSI = 100 - 100/(1 + RS)`);
  console.log(`         RS = 평균상승/평균하락 = ${d.rsi.avgGain.toFixed(4)}/${d.rsi.avgLoss.toFixed(4)}${d.rsi.avgLoss > 0 ? ` = ${(d.rsi.avgGain / d.rsi.avgLoss).toFixed(4)}` : " (하락 없음)"}`);
  console.log(`  RSI = ${d.rsi.rsi.toFixed(1)}`);
  const rsiInterpret = d.rsi.signal === "OVERSOLD" ? "📉 과매도 → 반등 가능 (매수 기회)" : d.rsi.signal === "OVERBOUGHT" ? "📈 과매수 → 조정 가능 (대기)" : "➡️ 중립 구간";
  console.log(`  해석: ${rsiInterpret}`);

  // ── 모델 6: 요일 패턴 ──
  console.log(`\n  📐 모델 6: 요일별 패턴`);
  console.log(`  ${THIN}`);
  console.log(`  수식: ${d.seasonal.equation}`);
  const dayOrder = ["월", "화", "수", "목", "금", "토", "일"];
  const effectStrs = dayOrder
    .filter(day => d.seasonal.dayOfWeekEffects[day] !== undefined)
    .map(day => {
      const e = d.seasonal.dayOfWeekEffects[day];
      return `${day}:${e >= 0 ? "+" : ""}${e.toFixed(1)}`;
    });
  console.log(`  ${effectStrs.join(" | ")}`);
  console.log(`  ⚠️  7일 데이터로는 패턴 신뢰도가 낮습니다`);

  // ── 종합 신호 ──
  console.log(`\n  ${THIN}`);
  console.log(`  🎯 종합 신호: ${signalEmoji(alert.signal)} ${alert.signalKo} (${alert.signal}) | 신뢰도: ${alert.confidence}%`);
  console.log(`  📊 위험도: ${riskKo(alert.riskScore)} (${alert.riskScore}/100)`);
  console.log(`  💡 근거: ${alert.reason}`);
}

function printAlertSummary(alerts: PriceAlert[]) {
  console.log(`\n${LINE}`);
  console.log("  🚨 원자재 매입 신호 종합 (2026-02-19 기준)");
  console.log(LINE);

  for (const a of alerts) {
    const priceStr = `${fmt(a.currentPrice.low)}~${fmt(a.currentPrice.high)}`;
    const pred7Str = `${fmt(a.predictedPrice7d.low)}~${fmt(a.predictedPrice7d.high)}`;
    console.log(`  ${a.icon} ${a.ingredient}`);
    console.log(`     ${signalEmoji(a.signal)} ${a.signalKo.padEnd(6)} | 신뢰도 ${(a.confidence + "%").padEnd(4)} | 현재 ${priceStr.padEnd(16)} | 7일후 ${pred7Str.padEnd(16)} | 위험 ${riskKo(a.riskScore)}`);
  }
}

function printRecommendations(alerts: PriceAlert[]) {
  console.log(`\n${LINE}`);
  console.log("  💡 사장님을 위한 매입 전략 추천");
  console.log(LINE);

  const groups = {
    URGENT_BUY: alerts.filter(a => a.signal === "URGENT_BUY"),
    BUY_NOW: alerts.filter(a => a.signal === "BUY_NOW"),
    HOLD: alerts.filter(a => a.signal === "HOLD"),
    WAIT: alerts.filter(a => a.signal === "WAIT"),
  };

  if (groups.URGENT_BUY.length > 0) {
    console.log(`\n  🔴 [긴급매수] 지금 바로 구매하세요!`);
    console.log(`  ${THIN}`);
    for (const a of groups.URGENT_BUY) {
      const pred7 = a.predictions.find(p => p.daysAhead === 7)!;
      const changePct = ((pred7.predicted - (a.currentPrice.low + a.currentPrice.high) / 2) / ((a.currentPrice.low + a.currentPrice.high) / 2) * 100).toFixed(1);
      console.log(`  ${a.icon} ${a.ingredient}: ${a.reason}`);
      console.log(`     → 7일 후 예측: ${fmt(pred7.low)}~${fmt(pred7.high)} (${changePct}%)`);
    }
  }

  if (groups.BUY_NOW.length > 0) {
    console.log(`\n  🟢 [매수적기] 이번 주 내 구매 권장`);
    console.log(`  ${THIN}`);
    for (const a of groups.BUY_NOW) {
      console.log(`  ${a.icon} ${a.ingredient}: ${a.reason}`);
    }
  }

  if (groups.HOLD.length > 0) {
    console.log(`\n  🟡 [보류] 추가 관망 추천`);
    console.log(`  ${THIN}`);
    for (const a of groups.HOLD) {
      console.log(`  ${a.icon} ${a.ingredient}: ${a.reason}`);
    }
  }

  if (groups.WAIT.length > 0) {
    console.log(`\n  ⚪ [대기] 급하지 않으면 기다리세요`);
    console.log(`  ${THIN}`);
    for (const a of groups.WAIT) {
      console.log(`  ${a.icon} ${a.ingredient}: ${a.reason}`);
    }
  }
}

function printMathSummary() {
  console.log(`\n${LINE}`);
  console.log("  📐 적용된 수학 모델 요약");
  console.log(LINE);
  console.log(`
  ┌──────────────────────────────────────────────────────────────┐
  │ 모델 1: 선형회귀 (OLS)                                      │
  │   y = ax + b                                                │
  │   a = Σ(x_i-x̄)(y_i-ȳ) / Σ(x_i-x̄)²                       │
  │   R² = 1 - SS_res/SS_tot                                   │
  ├──────────────────────────────────────────────────────────────┤
  │ 모델 2: 지수이동평균 (EMA)                                   │
  │   EMA_t = alpha × P_t + (1-alpha) × EMA_{t-1}              │
  │   단기 alpha=0.50 (3일), 장기 alpha=0.25 (7일)              │
  │   교차 → 매매 신호 생성                                      │
  ├──────────────────────────────────────────────────────────────┤
  │ 모델 3: 가격 외삽 (Extrapolation)                            │
  │   P(t+d) = a×(n-1+d) + b                                   │
  │   CI = P ± 1.96×SE×√(1 + 1/n + (x-x̄)²/Σ(x_i-x̄)²)        │
  ├──────────────────────────────────────────────────────────────┤
  │ 모델 4: 변동성 (Volatility)                                  │
  │   r_i = (P_i - P_{i-1}) / P_{i-1}                          │
  │   sigma = √(Σ(r_i-r̄)² / (N-1))                             │
  │   sigma_annual = sigma × √252                               │
  ├──────────────────────────────────────────────────────────────┤
  │ 모델 5: RSI 모멘텀                                           │
  │   RSI = 100 - 100/(1 + RS)                                  │
  │   RS = AvgGain / AvgLoss                                    │
  │   >70: 과매수(대기), <30: 과매도(매수)                       │
  ├──────────────────────────────────────────────────────────────┤
  │ 모델 6: 요일 패턴 (Seasonal)                                 │
  │   Effect(day) = mean(P_day) - P_overall                     │
  ├──────────────────────────────────────────────────────────────┤
  │ 종합 신호: 가중 투표                                         │
  │   buyScore = 0.25×회귀 + 0.20×EMA + 0.25×RSI               │
  │            + 0.15×변동성 + 0.15×추세                        │
  │   ≥0.70: 긴급매수  ≥0.50: 매수적기                          │
  │   waitScore ≥0.50: 대기  그 외: 보류                        │
  └──────────────────────────────────────────────────────────────┘
`);
}

function printDisclaimer() {
  console.log(LINE);
  console.log("  ⚠️  데이터 및 예측 한계 안내");
  console.log(LINE);
  console.log(`  • 분석 데이터: 7일분 (2026-02-13 ~ 2026-02-19)`);
  console.log(`  • 14일 이상 예측은 통계적 신뢰도가 매우 낮습니다 (참고용)`);
  console.log(`  • 주말 데이터는 직전 거래일 종가를 반영합니다`);
  console.log(`  • RSI는 표준 14일 대신 6일 기간으로 계산되었습니다`);
  console.log(`  • 실제 매입 결정은 거래처 견적, 보관 여건, 자금을 종합 판단하세요`);
  console.log(`  • 이 보고서는 AI 기반 참고 자료이며, 투자 조언이 아닙니다`);
  console.log(LINE);
}

function printJsonExport(alerts: PriceAlert[]) {
  console.log(`\n${LINE}`);
  console.log("  📡 알림 서비스용 JSON 데이터");
  console.log(LINE);
  console.log("--- ALERT_JSON_START ---");
  console.log(JSON.stringify(alerts, null, 2));
  console.log("--- ALERT_JSON_END ---");
}

// ════════════════════════════════════════════════════════════════
// 7. 메인 실행
// ════════════════════════════════════════════════════════════════

function main() {
  printHeader();

  const { alerts, details } = analyzeAll();

  // 원자재별 상세 분석 (데이터 순서대로)
  for (const ing of ingredients) {
    const d = details.get(ing.name)!;
    const alert = alerts.find(a => a.ingredient === ing.name)!;
    printIngredientAnalysis(ing, d, alert);
  }

  // 종합 테이블
  printAlertSummary(alerts);

  // 사장님 추천
  printRecommendations(alerts);

  // 수학 모델 요약
  printMathSummary();

  // 한계 안내
  printDisclaimer();

  // JSON 출력
  printJsonExport(alerts);
}

main();
