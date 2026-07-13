/**
 * Datos sembrados por scripts/seed.sh + seed-course-setup.php (SPECS §1.2).
 * Única fuente de verdad de nombres/valores esperados para los asserts.
 */
export const TESTDATA = {
  course: {
    shortname: process.env.COURSE_SHORTNAME ?? 'QA-EXAMS-101',
    fullname: 'QA Exams 101',
    category: 'QA',
  },
  quizzes: {
    general: {
      name: 'quiz-general',
      slots: 7, // 6 fijas + 1 aleatoria
      maxGrade: 7,
    },
    timed: {
      name: 'quiz-timed',
      slots: 2, // SEED-MC-01 + SEED-TF-01
      maxGrade: 2,
      timeLimitSecs: 120,
      gracePeriodSecs: 120, // holgado para runners de CI (auditoría C5)
      attempts: 2,
    },
    autosubmit: {
      name: 'quiz-autosubmit',
      slots: 2, // SEED-MC-01 + SEED-TF-01
      maxGrade: 2,
      timeLimitSecs: 60, // flujo 7: auto-envío al expirar (overduehandling=autosubmit)
    },
  },
  /**
   * Matriz de aislamiento (auditoría C2): cada spec que CONSUME intentos usa un par
   * (quiz, usuario) ÚNICO en toda la suite y corre resetAttempts(quiz, user) en su
   * beforeAll. Así fullyParallel nunca produce "attempt already in progress", los
   * intentos no se agotan entre corridas (repetibilidad) y un reset jamás borra
   * los intentos en vuelo de otro spec. Los specs read-only pueden compartir usuario.
   */
  attemptPairs: {
    studentFlows: { quiz: 'quiz-general', user: 'student1' }, // spec 04 (flujos 6, 8, 9)
    grading: { quiz: 'quiz-general', user: 'student2' }, // spec 06 (flujo 10)
    focusguard: { quiz: 'quiz-general', user: 'student3' }, // spec 09 (Cambio 2)
    timer: { quiz: 'quiz-autosubmit', user: 'student1' }, // spec 05 (flujo 7 — proyecto timed)
    reports: { quiz: 'quiz-autosubmit', user: 'student2' }, // spec 07 (flujo 11: override + reportes)
    gracePenalty: { quiz: 'quiz-timed', user: 'student2' }, // spec 10 (Cambio 4 — proyecto timed)
  },
  questions: {
    multichoice: { name: 'SEED-MC-01', correct: 'París' },
    truefalse: { name: 'SEED-TF-01', correct: 'True' },
    shortanswer: { name: 'SEED-SA-01', correct: 'Madrid' },
    numerical: { name: 'SEED-NUM-01', correct: '42' },
    matching: {
      name: 'SEED-MATCH-01',
      pairs: [
        { item: 'Italia', match: 'Roma' },
        { item: 'Alemania', match: 'Berlín' },
        { item: 'Portugal', match: 'Lisboa' },
      ],
    },
    essay: { name: 'SEED-ESSAY-01' },
  },
} as const;
