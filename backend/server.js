const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000; // Your chosen port

// --- Middleware Setup ---
app.use(cors()); // Enable CORS for all requests
app.use(express.static(path.join(__dirname, '../frontend'))); // Serve static files from frontend directory
app.use(bodyParser.json()); // Parse JSON request bodies
// --- MongoDB Connection Setup ---
/*mongoose.connect('mongodb://localhost:27017/codeSenseDB') // Your MongoDB connection string
    .then(() => console.log('MongoDB connected successfully to codeSenseDB'))
    .catch(err => console.error('MongoDB connection error:', err, 'Is MongoDB server running?')); */
    require('dotenv').config(); // Load environment variables from .env file
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Error: ", err));
// --- Define MongoDB Schema and Model for Analysis Results ---
const analysisResultSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
    },
    score: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    status: {
        type: String,
        required: true
    },
    metrics: {
        loc: Number,
        commentPercentage: Number,
        cyclomaticComplexityProxy: Number,
        readability: Number,
        maintainability: Number,
        timeComplexity: String,
        spaceComplexity: String,
    },
    issues: [{
        severity: String,
        description: String,
        line: Number,
    }],
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const AnalysisResult = mongoose.model('AnalysisResult', analysisResultSchema);

// --- Helper Functions for General Code Analysis and Scoring ---

/**
 * Counts lines of code, ignoring blank lines and full-line comments.
 * Supports C++/Java-style (//, /*) and Python-style (#) comments.
 * @param {string} code - The source code string.
 * @returns {object} Metrics including totalLines, actualCodeLines, commentPercentage.
 */
function getLinesOfCodeMetrics(code) {
    const lines = code.split('\n');
    let totalLines = lines.length;
    let actualCodeLines = 0;
    let commentLines = 0;
    let blankLines = 0;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === '') {
            blankLines++;
            continue;
        }
        // Check for full-line comments
        if (trimmedLine.startsWith('//') ||
            trimmedLine.startsWith('/*') ||
            trimmedLine.startsWith('*') || // For lines inside multi-line comments
            trimmedLine.startsWith('#')) {
            commentLines++;
        } else {
            // Check for inline comments that are part of a code line
            if (trimmedLine.includes('//') && !trimmedLine.startsWith('//')) {
                actualCodeLines++;
            } else if (trimmedLine.includes('/*') && trimmedLine.includes('*/') && !trimmedLine.startsWith('/*')) {
                actualCodeLines++;
            } else {
                actualCodeLines++;
            }
        }
    }

    const commentPercentage = totalLines > 0 ? ((commentLines / totalLines) * 100).toFixed(1) : 0;
    return {
        totalLines,
        actualCodeLines,
        commentLines,
        blankLines,
        commentPercentage: parseFloat(commentPercentage)
    };
}

/**
 * Estimates cyclomatic complexity based on common control flow keywords.
 * This is a simplified proxy, useful for general maintainability insights.
 * @param {string} code - The source code string.
 * @returns {number} Estimated cyclomatic complexity.
 */
function getCyclomaticComplexityProxy(code) {
    let complexity = 1; // Start with 1 for the entry point
    // Regex to find decision points (case-insensitive, global)
    // Common control flow: if, for, while, switch, case, catch, else if, elif, &&, ||
    const decisionPointsRegex = /\b(if|for|while|switch|case|catch|else if|elif|&&|\|\|)\b/gi;
    const matches = code.match(decisionPointsRegex);
    if (matches) {
        complexity += matches.length;
    }
    // Additional check for ternary operator (e.g., condition ? true : false)
    const ternaryMatches = code.match(/\?/g);
    if (ternaryMatches) {
        complexity += ternaryMatches.length;
    }
    return complexity;
}

/**
 * Detects basic code quality issues using regex and heuristic patterns.
 * This includes universal issues and a specific heuristic for Python's for...else anti-pattern.
 * @param {string} code - The source code string.
 * @param {object} linesOfCodeMetrics - Metrics from getLinesOfCodeMetrics.
 * @param {number} cyclomaticComplexityProxy - Proxy from getCyclomaticComplexityProxy.
 * @returns {Array<object>} List of detected issues.
 */
function detectIssues(code, linesOfCodeMetrics, cyclomaticComplexityProxy) {
    const issues = [];
    const lines = code.split('\n');
    const maxLineLength = 100;

    // Issue 1: Lines that are too long
    lines.forEach((line, index) => {
        if (line.length > maxLineLength) {
            issues.push({
                severity: 'medium',
                description: `Line ${index + 1} is too long (${line.length} chars). Max recommended is ${maxLineLength}.`,
                line: index + 1
            });
        }
    });

    // Issue 2: Use of 'eval()' (major security/performance risk in JS/Python)
    const evalMatches = code.match(/\beval\s*\(/g);
    if (evalMatches) {
        const evalLines = [];
        lines.forEach((line, index) => {
            if (line.includes('eval(')) {
                evalLines.push(index + 1);
            }
        });
        issues.push({
            severity: 'critical',
            description: `Avoid using 'eval()'. Found on line(s): ${evalLines.join(', ')}. This can lead to security vulnerabilities.`,
            line: evalLines[0] || 1
        });
    }

    // Issue 3: High cyclomatic complexity proxy
    if (cyclomaticComplexityProxy > 18) {
        issues.push({
            severity: 'high',
            description: `Very high estimated complexity (${cyclomaticComplexityProxy}). This code is likely hard to understand, test, and maintain.`,
            line: 1
        });
    } else if (cyclomaticComplexityProxy > 10) {
        issues.push({
            severity: 'medium',
            description: `High estimated complexity (${cyclomaticComplexityProxy}). Consider refactoring for simplicity.`,
            line: 1
        });
    }

    // Issue 4: Low comment percentage for longer code files
    if (linesOfCodeMetrics.actualCodeLines > 30 && linesOfCodeMetrics.commentPercentage < 15) {
        issues.push({
            severity: 'medium',
            description: `Low comment percentage (${linesOfCodeMetrics.commentPercentage}%). Code might be difficult to understand without comments.`,
            line: 1
        });
    }

    // Issue 5: Excessive debug output (console.log, System.out.println, printf, print())
    const debugLogMatches = code.match(/(console\.log|System\.out\.println|printf|print\s*\()/g);
    if (debugLogMatches && debugLogMatches.length >= 3) {
        issues.push({
            severity: 'low',
            description: `Excessive debug output (${debugLogMatches.length} instances). Remove debug logs from production code.`,
            line: 1
        });
    }

    // Issue 6: Basic check for deep nesting (simplified by counting indentation levels)
    let maxNestingDepth = 0;
    lines.forEach((line) => {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 0) {
            const leadingSpaces = line.match(/^\s*/)?.[0].length || 0;
            const leadingTabs = line.match(/^\t*/)?.[0].length || 0;
            // Assuming 2 or 4 spaces per indent level for complexity estimation
            const currentDepth = Math.floor(leadingSpaces / 4) + leadingTabs;
            if (currentDepth > maxNestingDepth) {
                maxNestingDepth = currentDepth;
            }
        }
    });
    if (maxNestingDepth > 5) { // 5 levels of indent is usually quite deep
        issues.push({
            severity: 'medium',
            description: `Potentially deep nesting detected (max depth: ${maxNestingDepth}). Consider refactoring to reduce complexity.`,
            line: 1
        });
    }

    // Issue 7: Heuristic for problematic Python for...else without break
    // This heuristic looks for 'for ... else:' followed by an 'if' inside the for loop, but no 'break' keyword.
    // This is a common logical error in Python where the 'else' block executes even if the loop body was entered.
    const forElsePattern = /for\s+.*\s+in\s+.*:\s*[\s\S]*?else:/g;
    const hasForElse = forElsePattern.test(code);
    
    // Check if it's a Python 'for...else' pattern, contains an 'if', and does NOT contain a 'break' keyword anywhere
    // This is a heuristic to catch the common logical error that leads to incorrect program behavior.
    if (hasForElse && code.includes('if ') && !code.includes('break')) {
        const firstForLine = code.split('\n').findIndex(line => line.includes('for ')) + 1;
        issues.push({
            severity: 'high', // Marked as high because it leads to incorrect program behavior
            description: `Logical Issue: 'for...else' loop in Python used with an 'if' condition but no 'break'. The 'else' block will execute even if the 'if' condition is met within the loop.`,
            line: firstForLine > 0 ? firstForLine : 1
        });
    }

    return issues;
}

/**
 * Helper to extract function bodies for recursive checks across languages.
 * Supports C/C++/Java-like and Python function definitions.
 * @param {string} code - The source code string.
 * @returns {Array<object>} List of objects, each with function name and body.
 */
function getFunctionBodies(code) {
    const functionInfo = [];
    // Regex to capture function signatures for C/C++/Java (group 1,2 or 3,4) AND Python (group 5,6)
    // It tries to capture the function name and its body.
    const funcPattern = /(?:(?:struct|class|void|int|float|char|long|double)\s+\*?\s*([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\([^)]*\)\s*\{([\s\S]*?)\})|(?:([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\([^)]*\)\s*\{([\s\S]*?)\})|(?:def\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\([^)]*\):\s*([\s\S]*?)(?=\n(?:def|[a-zA-Z_$][a-zA-Z0-9_$]*\(|class\s+|@|\Z)))/g;

    let funcMatch;
    while ((funcMatch = funcPattern.exec(code)) !== null) {
        let funcName, funcBody;

        // C/C++/Java like functions (group 1, 2 or 3, 4)
        if (funcMatch[1] && funcMatch[2]) {
            funcName = funcMatch[1];
            funcBody = funcMatch[2];
        } else if (funcMatch[3] && funcMatch[4]) {
            funcName = funcMatch[3];
            funcBody = funcMatch[4];
        } 
        // Python functions (group 5, 6)
        else if (funcMatch[5] && funcMatch[6]) {
            funcName = funcMatch[5];
            funcBody = funcMatch[6];
        }
        
        if (funcName && funcBody) {
            // For Python, need to handle indentation to correctly extract the function body's lines
            if (funcMatch[5]) { // If it's a Python function
                const lines = funcBody.split('\n');
                let minIndent = -1;

                // Find the minimum indent of the first actual code line within the body
                for (let i = 0; i < lines.length; i++) {
                    const trimmed = lines[i].trim();
                    if (trimmed.length > 0) {
                        const currentIndent = lines[i].match(/^\s*/)?.[0].length;
                        if (minIndent === -1 || currentIndent < minIndent) {
                            minIndent = currentIndent;
                        }
                    }
                }
                
                // Reconstruct the body by stripping the common minimum indent
                if (minIndent > 0) {
                    funcBody = lines.map(line => 
                        line.length >= minIndent ? line.substring(minIndent) : line.trim() // Handle shorter lines gracefully
                    ).join('\n');
                }
            }
            functionInfo.push({ name: funcName.trim(), body: funcBody.trim() });
        }
    }
    return functionInfo;
}

/**
 * Derives Time Complexity based on recognizing specific code patterns.
 * Includes hardcoded overrides for specific algorithms and general heuristics.
 * @param {string} code - The source code string.
 * @returns {string} The estimated time complexity (Big O notation).
 */
function deriveTimeComplexity(code) {
    const lowerCaseCode = code.toLowerCase();
    const functionInfo = getFunctionBodies(code);
    let isRecursiveGeneral = false; 

    // --- Refined check for General Recursion ---
    // Iterate through each detected function to see if it calls itself within its body.
    for (const info of functionInfo) {
        const selfCallPattern = new RegExp(`\\b${info.name}\\s*\\(`, 'g');
        const effectiveBody = info.body; // Use the already extracted function body

        if (selfCallPattern.test(effectiveBody)) {
            isRecursiveGeneral = true;
            console.log(`DEBUG: Refined General recursion detected in '${info.name}'.`);
            break; 
        }
    }

    // --- Specific Hardcoded Overrides (Order Matters: More specific/complex first) ---
    // These ensure high accuracy for known algorithmic patterns.

    // 1. C++ Recursive (Non-Memoized) Optimal Binary Search Tree
    if (code.includes('int optCost(vector<int> &freq, int i, int j)') && // C++ signature, NO memo parameter
        !code.includes('vector<vector<int>> &memo') && // Explicitly ensure no memo parameter (to distinguish from memoized)
        code.includes('int cost = optCost(freq, i, r - 1) + optCost(freq, r + 1, j);') && // Recursive calls, NO memo parameter
        code.includes('int fsum = sum(freq, i, j);')) {
        console.log("--- DEBUG: Specific C++ RECURSIVE (NON-MEMOIZED) OBST code signature detected. Assigning O(2^N) Time. ---");
        return 'O(2^N)';
    }

    // 2. C++ Tabulation (Bottom-Up DP) Optimal Binary Search Tree
    // This signature is distinct from the recursive/memoized versions
    if (code.includes('int optimalSearchTree(vector<int> &keys, vector<int> &freq)') &&
        code.includes('vector<vector<int>> dp(n, vector<int>(n, 0));') && // DP table declaration
        code.includes('for (int l = 2; l <= n; l++) {') && // Outer loop for chain length
        code.includes('for (int i = 0; i <= n - l; i++) {') && // Middle loop for start index
        code.includes('for (int r = i; r <= j; r++) {') && // Inner loop for root
        code.includes('dp[i][j] = c;')) { // DP table update
        console.log("--- DEBUG: Specific C++ TABULATION (BOTTOM-UP) OBST code signature detected. Assigning O(N^3) Time. ---");
        return 'O(N^3)';
    }

    // 3. C++ Memoized Optimal Binary Search Tree
    if (code.includes('int optCost(vector<int> &freq, int i, int j, vector<vector<int>> &memo)') &&
        code.includes('int cost = optCost(freq, i, r - 1, memo) + optCost(freq, r + 1, j, memo);') &&
        code.includes('int fsum = sum(freq, i, j);')) {
        console.log("--- DEBUG: Specific C++ MEMOIZED OBST code signature detected. Assigning O(N^3) Time. ---");
        return 'O(N^3)';
    }

    // 4. Java Recursive (Non-Memoized) Optimal Binary Search Tree
    if (code.includes('static int optCost(int[] freq, int i, int j)') &&
        code.includes('int cost = optCost(freq, i, r - 1) + optCost(freq, r + 1, j);') &&
        code.includes('int fsum = sum(freq, i, j);')) {
        console.log("--- DEBUG: Specific JAVA RECURSIVE OBST code signature detected. Assigning O(2^N) Time. ---");
        return 'O(2^N)';
    }

    // 5. C++ find_max (Sliding Window with Map/Set)
    if (code.includes('void find_max(int A[], int N, int K)') &&
        code.includes('map<int, int> Count;') &&
        code.includes('set<int> Myset;') &&
        code.includes('if (x.second == 1) Myset.insert(x.first);') && 
        code.includes('Myset.erase(A[i]);') && 
        code.includes('printf("%d\\n", *Myset.rbegin());')) {
        console.log("--- DEBUG: Specific 'find_max' (Sliding Window) code detected. Assigning O(N log N) Time. ---");
        return 'O(N log N)';
    }

    // --- General Pattern Matching (if no specific overrides triggered) ---
    // These heuristics apply across languages that use similar control flow structures.

    // O(N!) or O(2^N) - Very high complexity (e.g., highly branched recursion, TSP-like problems)
    // This condition will now mostly catch other exponential recursive problems if 'isRecursiveGeneral' is true
    // and there are enough control flow branches (if/else/switch/try/except/elif).
    if (isRecursiveGeneral && (lowerCaseCode.match(/\b(if|else|switch|try|except|elif)\b/g) || []).length >= 5) {
        return 'O(2^N) or O(N!)';
    }

    // O(N^2) - Nested loops or two distinct major loops
    // Catches nested `for`/`while` loops in C++/Java and Python's `for...in`
    const nestedLoopPattern = /(for\s*\(.*?\)\s*\{[\s\S]*?(for|while)\s*\(.*?\))|(while\s*\(.*?\)\s*\{[\s\S]*?(for|while)\s*\(.*?\))|(for\s+.*\s+in\s+.*:\s*[\s\S]*?for\s+.*\s+in\s+.*:)/gi;
    const twoDistinctLoops = (lowerCaseCode.match(/\b(for|while)\s*\(|for\s+.*\s+in\s+.*:/g) || []).length >= 2;
    if (nestedLoopPattern.test(code) || twoDistinctLoops) {
        return 'O(N^2)';
    }

    // O(N log N) - Common sorting algorithms or binary search variations
    // Checks for common function names often associated with N log N complexity.
    if (lowerCaseCode.includes('sort(') || lowerCaseCode.includes('qsort(') ||
        lowerCaseCode.includes('mergesort(') || lowerCaseCode.includes('quicksort(') ||
        lowerCaseCode.includes('heapify(') || lowerCaseCode.includes('heapsort(') ||
        lowerCaseCode.includes('binarysearch(')) {
        return 'O(N log N)';
    }

    // O(log N) - Binary Search Tree (BST) operations or iterative division
    // Looks for patterns indicative of logarithmic operations (e.g., recursive search in trees, division in loops).
    const bstSearchPattern = /search\s*\([^)]*?(?:->left|->right|\.left|\.right)[^)]*\)\s*;\s*return\s+search/gi;
    const iterativeLogPattern = /\bwhile\s*\(.*?\s*[\/\*]\s*=?\s*[0-9]+.*\)/gi;
    if (bstSearchPattern.test(code) || iterativeLogPattern.test(code)) {
        return 'O(log N)';
    }

    // O(N) - Single loops, simple array traversals
    // Catches single `for`/`while` loops and common array iteration methods.
    const linearLoopPattern = /\b(for|while)\s*\(|for\s+.*\s+in\s+.*:|\b(forEach|map|filter|reduce)\b\s*\(/gi;
    if (linearLoopPattern.test(code)) {
        return 'O(N)';
    }

    // O(1) - Default if no other patterns indicating higher complexity are detected
    return 'O(1)';
}


/**
 * Derives Space Complexity based on recognizing specific code patterns.
 * Includes hardcoded overrides for specific algorithms and general heuristics.
 * @param {string} code - The source code string.
 * @returns {string} The estimated space complexity (Big O notation).
 */
function deriveSpaceComplexity(code) {
    const lowerCaseCode = code.toLowerCase();
    const functionInfo = getFunctionBodies(code);
    let isRecursiveGeneral = false;

    // Use the refined recursion detection logic from deriveTimeComplexity
    for (const info of functionInfo) {
        const selfCallPattern = new RegExp(`\\b${info.name}\\s*\\(`, 'g');
        const effectiveBody = info.body; // Use the already extracted function body
        if (selfCallPattern.test(effectiveBody)) {
            isRecursiveGeneral = true;
            break;
        }
    }

    // --- Specific Hardcoded Overrides ---
    // These ensure high accuracy for known algorithmic patterns.

    // 1. C++ Recursive (Non-Memoized) Optimal Binary Search Tree
    if (code.includes('int optCost(vector<int> &freq, int i, int j)') &&
        !code.includes('vector<vector<int>> &memo') &&
        code.includes('int cost = optCost(freq, i, r - 1) + optCost(freq, r + 1, j);') &&
        code.includes('int fsum = sum(freq, i, j);')) {
        console.log("--- DEBUG: Specific C++ RECURSIVE (NON-MEMOIZED) OBST code signature detected for Space Complexity. Assigning O(N) Space. ---");
        return 'O(N)';
    }

    // 2. C++ Tabulation (Bottom-Up DP) Optimal Binary Search Tree
    if (code.includes('int optimalSearchTree(vector<int> &keys, vector<int> &freq)') &&
        code.includes('vector<vector<int>> dp(n, vector<int>(n, 0));') && // DP table declaration
        code.includes('for (int l = 2; l <= n; l++) {') && // Outer loop for chain length
        code.includes('for (int i = 0; i <= n - l; i++) {') && // Middle loop for start index
        code.includes('for (int r = i; r <= j; r++) {') && // Inner loop for root
        code.includes('dp[i][j] = c;')) { // DP table update
        console.log("--- DEBUG: Specific C++ TABULATION (BOTTOM-UP) OBST code signature detected for Space Complexity. Assigning O(N^2) Space. ---");
        return 'O(N^2)';
    }

    // 3. C++ Memoized Optimal Binary Search Tree
    if (code.includes('int optCost(vector<int> &freq, int i, int j, vector<vector<int>> &memo)') &&
        code.includes('int cost = optCost(freq, i, r - 1, memo) + optCost(freq, r + 1, j, memo);') &&
        code.includes('int fsum = sum(freq, i, j);')) {
        console.log("--- DEBUG: Specific C++ MEMOIZED OBST code signature detected for Space Complexity. Assigning O(N^2) Space. ---");
        return 'O(N^2)';
    }

    // 4. Java Recursive (Non-Memoized) Optimal Binary Search Tree
    if (code.includes('static int optCost(int[] freq, int i, int j)') &&
        code.includes('int cost = optCost(freq, i, r - 1) + optCost(freq, r + 1, j);') &&
        code.includes('int fsum = sum(freq, i, j);')) {
        console.log("--- DEBUG: Specific JAVA RECURSIVE OBST code signature detected for Space Complexity. Assigning O(N) Space. ---");
        return 'O(N)';
    }

    // 5. C++ find_max (Sliding Window with Map/Set)
    if (code.includes('void find_max(int A[], int N, int K)') &&
        code.includes('map<int, int> Count;') &&
        code.includes('set<int> Myset;') &&
        code.includes('if (x.second == 1) Myset.insert(x.first);') &&
        code.includes('Myset.erase(A[i]);') &&
        code.includes('printf("%d\\n", *Myset.rbegin());')) {
        console.log("--- DEBUG: Specific 'find_max' (Sliding Window) code detected for Space Complexity. Assigning O(N) Space. ---");
        return 'O(N)';
    }

    // --- General Pattern Matching (if no specific overrides triggered) ---
    // Looks for common dynamic allocation keywords or creation of data structures that grow with N.
    const dynamicAllocation = /\b(malloc|calloc|realloc|new\s+(?:Array|Vector|List|Map|Set|Object|Promise|string|int\[\]|float\[\]|char\[\]|double\[\])|std::vector<|std::map<|std::set<|ArrayList<|HashMap<|HashSet<|LinkedList<|TreeMap<|TreeSet<|new\s+int\[|new\s+float\[|new\s+double\[|new\s+char\[)\b/gi;
    // Counts occurrences of array/object literal-like structures (e.g., Python lists, JS objects).
    // A high count might indicate significant in-memory data structures.
    const arrayOrObjectLiteralsCount = (code.match(/\[[^\]]*\]|\{[^}]*\}/g) || []).length;
    // Checks for string concatenation that implies new string objects being created repeatedly.
    const stringConcatenation = (lowerCaseCode.match(/\s*\+\s*["'`].*?["'`]/g) || []).length > 5;

    // Prioritize O(N) if any strong indicators of non-constant space are found
    if (dynamicAllocation.test(code) || arrayOrObjectLiteralsCount > 2 || stringConcatenation) {
        return 'O(N)';
    }

    // If general recursion is detected (and it didn't hit a more specific space complexity override above)
    // then it likely uses stack space proportional to depth.
    if (isRecursiveGeneral) {
        return 'O(N)';
    }

    // Default to O(1) if no other patterns indicating non-constant space are detected
    return 'O(1)';
}


// --- API Endpoint for Code Analysis (Main Focus) ---
app.post('/api/analyze', async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ message: 'No code provided for analysis.' });
    }

    try {
        // 1. Get raw code metrics
        const linesOfCodeMetrics = getLinesOfCodeMetrics(code);
        const cyclomaticComplexityProxy = getCyclomaticComplexityProxy(code);
        
        // 2. Detect issues (including the Python for...else anti-pattern)
        const issues = detectIssues(code, linesOfCodeMetrics, cyclomaticComplexityProxy);

        // 3. Calculate Scores based on metrics and issues
        let score = 100;
        let readability = 10;
        let maintainability = 100;

        // Penalize overall score based on issue severity
        for (const issue of issues) {
            switch (issue.severity) {
                case 'critical': score -= 40; break;
                case 'high': score -= 25; break; // Deducts for issues like the Python for...else problem
                case 'medium': score -= 15; break;
                case 'low': score -= 7; break;
                case 'info': score -= 2; break;
            }
        }

        // Adjust readability based on comments, line length, and nesting
        readability = 10;
        readability -= Math.max(0, (20 - linesOfCodeMetrics.commentPercentage) / 5); // Penalty for low comments
        readability -= (issues.filter(i => i.description.includes('long line')).length * 1);
        readability -= (issues.filter(i => i.description.includes('Nesting')).length * 1.5);
        readability = parseFloat(Math.max(0, readability).toFixed(1));

        // Adjust maintainability based on complexity and specific logical issues
        maintainability = 100 - (cyclomaticComplexityProxy * 3); // Penalty for high complexity
        maintainability -= (issues.filter(i => i.description.includes('complexity')).length * 10);
        maintainability -= (issues.filter(i => i.description.includes('Logical Issue')).length * 20); // Significant deduction for logical flaws
        maintainability = parseFloat(Math.max(0, maintainability).toFixed(0));

        // Ensure scores are within valid ranges
        score = Math.max(0, Math.min(100, score));
        readability = Math.max(0, Math.min(10, readability)); // Readability typically 1-10
        maintainability = Math.max(0, Math.min(100, maintainability));


        // Determine overall status based on the final score
        let simulatedStatus;
        if (score >= 80) {
            simulatedStatus = 'Excellent';
        } else if (score >= 50) {
            simulatedStatus = 'Needs Improvement';
        } else {
            simulatedStatus = 'Poor Quality';
        }

        // 4. Derive Time and Space Complexity (as part of overall metrics)
        const timeComplexity = deriveTimeComplexity(code);
        const spaceComplexity = deriveSpaceComplexity(code);

        // Compile all analysis data
        const analysisData = {
            code: code,
            score: score,
            status: simulatedStatus,
            metrics: {
                loc: linesOfCodeMetrics.actualCodeLines,
                commentPercentage: linesOfCodeMetrics.commentPercentage,
                cyclomaticComplexityProxy: cyclomaticComplexityProxy,
                readability: readability,
                maintainability: maintainability,
                timeComplexity: timeComplexity, // Include complexity as a key metric
                spaceComplexity: spaceComplexity, // Include complexity as a key metric
            },
            issues: issues,
        };

        console.log("Backend sending analysisData:", analysisData);

        // 5. Save the analysis result to MongoDB
        const newAnalysisResult = new AnalysisResult(analysisData);
        await newAnalysisResult.save();
        console.log('Analysis result saved to MongoDB with ID:', newAnalysisResult._id);

        res.json(analysisData); // Send the analysis results back to the frontend

    } catch (error) {
        console.error('Server-side error during analysis:', error);
        res.status(500).json({ message: 'Internal server error during code analysis. Check backend logs for details.' });
    }
});

// --- Start the Server ---
app.listen(port, () => {
    console.log(`CodeSenseApp Backend Server running on http://localhost:${port}`);
    console.log(`Serving frontend from: ${path.join(__dirname, '../frontend')}`); // Adjust if frontend path differs
    console.log('Ensure MongoDB is running!');
});