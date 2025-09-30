import { formatMarkdown } from './markdownFormatter';

interface TestCase {
  name: string;
  input: string;
  expected: string;
}

const testCases: TestCase[] = [
  // Test Case 1: List Formatting
  {
    name: 'should add a space after a hyphen list marker',
    input: '-item1\n-item2',
    expected: '- item1\n- item2',
  },
  {
    name: 'should add a space after an asterisk list marker',
    input: '* item1\n*item2',
    expected: '* item1\n* item2',
  },
  {
    name: 'should add a space after a numbered list marker',
    input: '1.item1\n2. item2',
    expected: '1. item1\n2. item2',
  },
  {
    name: 'should preserve indentation for nested lists',
    input: '  -nested-item',
    expected: '  - nested-item',
  },
  // Test Case 2: Trailing Whitespace
  {
    name: 'should trim trailing whitespace from a single line',
    input: 'Hello world.   ',
    expected: 'Hello world.',
  },
  {
    name: 'should trim trailing whitespace from multiple lines',
    input: 'line 1   \nline 2\t\nline 3  ',
    expected: 'line 1\nline 2\nline 3',
  },
  // Test Case 3: Newline Normalization
  {
    name: 'should collapse 3 newlines into 2',
    input: 'Paragraph 1.\n\n\nParagraph 2.',
    expected: 'Paragraph 1.\n\nParagraph 2.',
  },
  {
    name: 'should collapse 5 newlines into 2',
    input: 'Paragraph 1.\n\n\n\n\nParagraph 2.',
    expected: 'Paragraph 1.\n\nParagraph 2.',
  },
  {
    name: 'should not collapse 2 newlines',
    input: 'Paragraph 1.\n\nParagraph 2.',
    expected: 'Paragraph 1.\n\nParagraph 2.',
  },
  // Test Case 4: Code Block Preservation (Pre-Change)
  {
    name: 'should not format list-like items inside a code block',
    input: 'Some text.\n```\n- item1\n-item2\n```\nMore text.',
    expected: 'Some text.\n```\n- item1\n-item2\n```\nMore text.',
  },
  // Test Case 5: Combined Logic
  {
    name: 'should format lists and paragraphs but not code blocks (pre-change)',
    input: '# Title  \n\n-list-item1  \n\n\n```python\ndef my_func(): \n  return 1  \n```\n\n- list-item2',
    expected: '# Title\n\n- list-item1\n\n```python\ndef my_func(): \n  return 1\n```\n\n- list-item2',
  },
  // Test Case 6: Edge Cases
  {
    name: 'should handle an empty string',
    input: '',
    expected: '',
  },
  {
    name: 'should handle a string with only whitespace',
    input: '   \n  \t  \n ',
    expected: '\n\n', // Note: Trailing whitespace is trimmed, but newlines are normalized.
  },
  {
    name: 'should not change an already well-formatted string',
    input: '# Header\n\n- A list item.\n- Another list item.\n\n```js\nconsole.log("hello");\n```',
    expected: '# Header\n\n- A list item.\n- Another list item.\n\n```js\nconsole.log("hello");\n```',
  },
  // Test Case 7: NEW Code Block Formatting
  {
    name: 'should lowercase the language identifier',
    input: '```JavaScript\nconsole.log("Hi");\n```',
    expected: '```javascript\nconsole.log("Hi");\n```',
  },
  {
    name: 'should trim leading/trailing blank lines inside a code block',
    input: '```js\n\n\nconst x = 1;\n\n\n```',
    expected: '```js\nconst x = 1;\n```',
  },
  {
    name: 'should dedent code with common leading whitespace',
    input: '```\n  function hello() {\n    return "world";\n  }\n```',
    expected: '```\nfunction hello() {\n  return "world";\n}\n```',
  },
  {
    name: 'should handle mixed indentation correctly when dedenting',
    input: '```python\n    def func():\n        print("hello")\n\n    if True:\n      pass\n```',
    expected: '```python\ndef func():\n    print("hello")\n\nif True:\n  pass\n```',
  },
  {
    name: 'should not change a code block with no common indentation',
    input: '```\nvar x = 1;\n  var y = 2;\n```',
    expected: '```\nvar x = 1;\n  var y = 2;\n```',
  },
  {
    name: 'should format list and dedent code in the same pass',
    input: '- a list  \n\n```js\n  const a = 1;\n    const b = 2;\n```',
    expected: '- a list\n\n```js\nconst a = 1;\n  const b = 2;\n```',
  },
];

/**
 * A simple validation suite for the markdown formatter.
 * This function can be imported and run during development to ensure the formatter
 * behaves as expected. It logs results to the console.
 */
export function validateMarkdownFormatter(): { passed: number; failed: number; total: number } {
  console.log('--- Running Markdown Formatter Validation ---');
  let passed = 0;
  let failed = 0;

  testCases.forEach(({ name, input, expected }, index) => {
    const output = formatMarkdown(input);
    if (output === expected) {
      // console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL (${index + 1}): ${name}`);
      console.error('  Input:    ' + JSON.stringify(input));
      console.error('  Expected: ' + JSON.stringify(expected));
      console.error('  Received: ' + JSON.stringify(output));
      failed++;
    }
  });

  console.log('--- Validation Complete ---');
  const total = testCases.length;
  console.log(`Result: ${passed}/${total} tests passed.`);

  if (failed > 0) {
    console.error(`🔴 ${failed} test(s) failed.`);
  } else {
    console.log('✅ All validation tests passed successfully!');
  }

  return { passed, failed, total };
}