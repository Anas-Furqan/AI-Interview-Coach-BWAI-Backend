import vm from 'node:vm';
import { isDeepStrictEqual } from 'node:util';
import { getChallengeById } from '../config/codingChallenges';

export interface CodingEvaluationResult {
  score: number;
  feedback: string;
  hint: string;
  exampleAnswer: string;
  rubric: {
    passed: number;
    total: number;
    correctness: number;
    codeQuality: number;
    complexitySignal: string;
  };
}

function normalizeComparableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeComparableValue);
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, v]) => [key, normalizeComparableValue(v)] as const)
      .sort((a, b) => a[0].localeCompare(b[0]));
    return Object.fromEntries(entries);
  }

  return value;
}

function estimateCodeQuality(code: string): number {
  const lines = code.split(/\r?\n/).filter(line => line.trim().length > 0);
  const hasComments = /\/\/|\/\*/.test(code);
  const hasMeaningfulNames = /(const|let|function)\s+[a-zA-Z_][a-zA-Z0-9_]{2,}/.test(code);
  const lineCountScore = lines.length >= 4 && lines.length <= 80 ? 4 : 2;
  const commentScore = hasComments ? 3 : 1;
  const namingScore = hasMeaningfulNames ? 3 : 1;
  return Math.min(10, lineCountScore + commentScore + namingScore);
}

function estimateComplexitySignal(code: string): string {
  const nestedLoopMatch = /for\s*\([^)]*\)\s*\{[\s\S]*for\s*\(/m.test(code) || /while\s*\([^)]*\)\s*\{[\s\S]*while\s*\(/m.test(code);
  const hashmapSignal = /Map\(|Object\.create\(|\{\}|Set\(/.test(code);

  if (nestedLoopMatch && !hashmapSignal) return 'Possible O(n^2); discuss optimization opportunities.';
  if (hashmapSignal) return 'Good use of indexed/hash structures where applicable.';
  return 'Complexity appears reasonable; verify with edge-case discussion.';
}

function createRunner(code: string, functionName: string): (...args: unknown[]) => unknown {
  const sandbox: Record<string, unknown> = {
    module: { exports: {} },
    exports: {},
  };
  const context = vm.createContext(sandbox);
  const compileScript = new vm.Script(`'use strict';\n${code}`);
  compileScript.runInContext(context, { timeout: 700 });

  const moduleExports = (sandbox.module as { exports?: Record<string, unknown> }).exports || {};
  const direct = sandbox[functionName];
  const fromModule = moduleExports[functionName];
  const defaultExport = moduleExports;
  const candidate = direct || fromModule || defaultExport;

  if (typeof candidate !== 'function') {
    throw new Error(`Function ${functionName} was not found. Ensure your code defines it.`);
  }

  return (...args: unknown[]) => {
    sandbox.__fn = candidate;
    sandbox.__args = args;
    const runScript = new vm.Script('__result = __fn(...__args);');
    runScript.runInContext(context, { timeout: 600 });
    return sandbox.__result;
  };
}

export function evaluateCodingAnswer(challengeId: string, code: string): CodingEvaluationResult {
  const challenge = getChallengeById(challengeId);
  if (!challenge) {
    return {
      score: 0,
      feedback: 'Could not map your answer to a known coding challenge. Please include the full function implementation.',
      hint: 'Make sure your code matches the requested function signature.',
      exampleAnswer: 'Follow the starter signature and return the expected output type.',
      rubric: {
        passed: 0,
        total: 0,
        correctness: 0,
        codeQuality: 0,
        complexitySignal: 'No challenge matched.',
      },
    };
  }

  let runner: (...args: unknown[]) => unknown;
  try {
    runner = createRunner(code, challenge.functionName);
  } catch (error: any) {
    return {
      score: 1,
      feedback: `Code could not run: ${String(error?.message || 'unknown runtime error')}`,
      hint: `Define function ${challenge.functionName} exactly and return the expected output type.`,
      exampleAnswer: challenge.starterCode,
      rubric: {
        passed: 0,
        total: challenge.testCases.length,
        correctness: 0,
        codeQuality: estimateCodeQuality(code),
        complexitySignal: estimateComplexitySignal(code),
      },
    };
  }

  let passed = 0;
  const failed: string[] = [];

  challenge.testCases.forEach(testCase => {
    try {
      const actual = runner(...testCase.input);
      const expected = testCase.expected;
      const ok = isDeepStrictEqual(normalizeComparableValue(actual), normalizeComparableValue(expected));
      if (ok) {
        passed += 1;
      } else {
        failed.push(`${testCase.description} failed`);
      }
    } catch {
      failed.push(`${testCase.description} threw runtime error`);
    }
  });

  const total = challenge.testCases.length;
  const correctness = total > 0 ? Math.round((passed / total) * 10) : 0;
  const codeQuality = estimateCodeQuality(code);
  const weighted = (correctness * 0.75) + (codeQuality * 0.25);
  const score = Math.max(1, Math.min(10, Math.round(weighted)));
  const complexitySignal = estimateComplexitySignal(code);

  const feedback = [
    `Passed ${passed}/${total} automated tests for ${challenge.title}.`,
    failed.length ? `Issues: ${failed.join('; ')}.` : 'All core tests passed.',
    complexitySignal,
  ].join(' ');

  const hint = failed.length
    ? 'Re-check edge cases and return shape strictly against the function contract.'
    : 'Great correctness. Improve by clearly explaining trade-offs and complexity.';

  return {
    score,
    feedback,
    hint,
    exampleAnswer: challenge.starterCode,
    rubric: {
      passed,
      total,
      correctness,
      codeQuality,
      complexitySignal,
    },
  };
}
