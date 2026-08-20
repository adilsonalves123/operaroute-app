export const CASSINO_IA_THRESHOLDS = {
  reading: {
    /** Confiança mínima por leitura — abaixo disso marca baixa_confianca. */
    confidenceMin: 0.62,
    /** Score para pré-preencher na UI (operador sempre confirma). */
    scoreMinApply: 68,
    /** Score para considerar alta confiança sem revisão obrigatória. */
    scoreApprovedAi: 85,
    /** Score mínimo para ainda sugerir valores quando a leitura não passou no auto-apply. */
    scoreMinSugestao: 1,
    jumpMultiplier: 35,
    jumpAbsoluteFloor: 3_500_000,
  },
  scoring: {
    lowConfidencePenalty: 10,
    regressionPenalty: 24,
    highJumpPenalty: 8,
    divergenceBasePenalty: 10,
    divergencePerDigitPenalty: 2,
    /** Penalidade menor quando só os últimos dígitos divergem (OCR comum). */
    divergenceLevePenalty: 6,
  },
  photoQuality: {
    /** Resolução mínima — fotos de celular comprimidas costumam passar aqui. */
    minImageSide: 540,
    maxSampleSide: 320,
    darkPixelThreshold: 28,
    brightPixelThreshold: 235,
    minAverageLuminance: 42,
    maxDarkRatio: 0.78,
    maxBrightRatio: 0.32,
    maxAverageLuminance: 225,
    minFocusScore: 7,
  },
  history: {
    minSamples: 3,
    warningAverageMultiplier: 3.4,
    warningMaxMultiplier: 2.2,
    warningAbsoluteFloor: 120_000,
    /** Histórico só avisa — não bloqueia sugestão (operador confirma). */
    blockAverageMultiplier: 99,
    blockMaxMultiplier: 99,
    blockAbsoluteFloor: 99_000_000,
    warningPenalty: 6,
    blockPenalty: 0,
  },
  preprocess: {
    scaleMultiplier: 2.2,
    sharpenCenterWeight: 1.48,
    sharpenNeighborWeight: 0.12,
  },
  exceptions: {
    scoreMinApplyComExcecao: 58,
    regressionPenaltyRecovery: 28,
    manutencaoPenaltyRecovery: 22,
  },
} as const;
