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
      gracePeriodSecs: 60,
      attempts: 2,
    },
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
