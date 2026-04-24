export interface CodingChallenge {
  id: string;
  title: string;
  prompt: string;
  functionName: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  starterCode: string;
  testCases: Array<{
    input: unknown[];
    expected: unknown;
    description: string;
  }>;
}

const CHALLENGES: CodingChallenge[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    prompt: 'Given an integer array nums and an integer target, return indices of the two numbers such that they add up to target.',
    functionName: 'twoSum',
    difficulty: 'EASY',
    starterCode: `function twoSum(nums, target) {
  // return [index1, index2]
}`,
    testCases: [
      { input: [[2, 7, 11, 15], 9], expected: [0, 1], description: 'Basic pair exists' },
      { input: [[3, 2, 4], 6], expected: [1, 2], description: 'Pair in middle/end' },
      { input: [[3, 3], 6], expected: [0, 1], description: 'Duplicate values' },
    ],
  },
  {
    id: 'longest-substring-without-repeat',
    title: 'Longest Substring Without Repeating Characters',
    prompt: 'Return the length of the longest substring without repeating characters.',
    functionName: 'lengthOfLongestSubstring',
    difficulty: 'MEDIUM',
    starterCode: `function lengthOfLongestSubstring(s) {
  // return number
}`,
    testCases: [
      { input: ['abcabcbb'], expected: 3, description: 'abc length 3' },
      { input: ['bbbbb'], expected: 1, description: 'single unique char' },
      { input: ['pwwkew'], expected: 3, description: 'wke length 3' },
    ],
  },
  {
    id: 'merge-intervals',
    title: 'Merge Intervals',
    prompt: 'Given an array of intervals where intervals[i] = [start, end], merge all overlapping intervals.',
    functionName: 'mergeIntervals',
    difficulty: 'HARD',
    starterCode: `function mergeIntervals(intervals) {
  // return merged intervals
}`,
    testCases: [
      { input: [[[1, 3], [2, 6], [8, 10], [15, 18]]], expected: [[1, 6], [8, 10], [15, 18]], description: 'Standard overlap merge' },
      { input: [[[1, 4], [4, 5]]], expected: [[1, 5]], description: 'Touching bounds merge' },
      { input: [[[1, 4], [0, 2], [3, 5]]], expected: [[0, 5]], description: 'Nested and chained overlap' },
    ],
  },
];

export function getChallengeById(id: string): CodingChallenge | null {
  return CHALLENGES.find(challenge => challenge.id === id) || null;
}

export function pickChallenge(index: number, difficulty: string): CodingChallenge {
  const normalizedDifficulty = String(difficulty || 'MEDIUM').toUpperCase();
  const pool = CHALLENGES.filter(challenge => challenge.difficulty === normalizedDifficulty);
  const fallbackPool = pool.length > 0 ? pool : CHALLENGES;
  return fallbackPool[index % fallbackPool.length];
}

export function buildChallengeQuestionText(challenge: CodingChallenge): string {
  return [
    `Coding Challenge: ${challenge.title}`,
    challenge.prompt,
    '',
    `Use JavaScript and implement function: ${challenge.functionName}`,
    'Starter:',
    challenge.starterCode,
    '',
    `Reference marker: [CHALLENGE:${challenge.id}]`,
    'Explain your approach and time/space complexity after code.',
  ].join('\n');
}
