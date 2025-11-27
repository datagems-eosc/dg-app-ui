# Code Quality

DataGEMS Front-end maintains high code quality standards through automated workflows and continuous monitoring. This page describes the automated systems that ensure code reliability, security, and maintainability.

## Overview

## Code Analysis

Static code analysis is the process of examining source code without executing it, to identify potential errors, vulnerabilities, or deviations from coding standards. It is typically performed using tools that analyze the code's structure, syntax, and logic to detect issues such as bugs, security flaws, or maintainability problems early in the development cycle. This helps improve code quality, reduce technical debt, and ensure compliance with best practices before the software is run or deployed.

Static code analysis is a process that has been tied with the development and release lifecycle through the configured GitHub Actions workflow that performs security, quality and maintenability of the code base.

## Code Metrics

Code metrics are quantitative measurements used to assess various aspects of source code quality and complexity. They help developers understand how maintainable, efficient, and error-prone a codebase might be. Common code metrics include lines of code (LOC), cyclomatic complexity, maintenability index, and coupling levels. By analyzing these metrics, teams can identify potential issues, enforce coding standards, and improve overall software quality throughout the development lifecycle.

## Vulnerability checks

Vulnerability checks are processes used to identify known security weaknesses in software, libraries, or dependencies. These checks typically scan the codebase, configuration files, or external packages against databases of publicly disclosed vulnerabilities. By detecting issues such as outdated libraries, insecure functions, or misconfigurations, vulnerability checks help developers address security risks early and maintain a secure software environment.


The project uses multiple automated workflows that run on every code change to ensure quality and security standards are met before code reaches production. These workflows are integrated into the GitHub Actions CI/CD pipeline and provide immediate feedback to developers.

## Continuous Integration Workflow

The CI workflow automatically runs on every push and pull request to the `main`, `develop`, and `staging` branches. This ensures that all code changes meet quality standards before being merged.

### Code Quality Checks


**Lint with Biome**

[Biome](https://biomejs.dev/) is used to validate code quality and formatting. It checks for:

- Code style consistency
- Common programming errors
- Best practices violations
- Formatting issues

All code must pass Biome linting before it can be merged into protected branches.

**Type Checking**

TypeScript type checking ensures:

- Type safety across the entire codebase
- Early detection of type-related bugs
- Better IDE support and autocomplete
- Improved code documentation through types

The `tsc --noEmit` command validates all TypeScript types without generating output files.

### Testing

Automated tests run on every code change to verify:

- Unit test coverage
- Component functionality
- Integration between modules
- Regression prevention

Test coverage reports are generated and can be reviewed to ensure adequate code coverage.

### Security Audit

Dependency security scanning checks for:

- Known vulnerabilities in npm packages
- Outdated dependencies with security issues
- License compliance issues
- Supply chain security risks

The audit uses npm's built-in security scanning to identify and report any vulnerabilities in the project's dependencies.

### Merge Requirements

All checks must pass before code can be merged:

✅ Linting (Biome)  
✅ Type checking (TypeScript)  
✅ Tests (with coverage)  
✅ Security audit (npm)

This ensures that only high-quality, secure code enters the main codebase.

## CodeQL Analysis

[CodeQL](https://codeql.github.com/) is GitHub's semantic code analysis engine that identifies security vulnerabilities and code quality issues.

### What CodeQL Analyzes

- **Languages**: JavaScript and TypeScript
- **Query Suite**: Security and quality rules
- **Scope**: Entire codebase including dependencies

### When CodeQL Runs

- On push to `main`, `develop`, and `staging` branches
- On pull requests to protected branches
- Weekly scheduled scans
- Can be manually triggered when needed

### Analysis Results

Results are displayed in the **Security** tab of the GitHub repository under **Code scanning alerts**. Each finding includes:

- Severity level (Critical, High, Medium, Low)
- Detailed description of the issue
- Location in code
- Suggested remediation steps
- CWE/CVE references where applicable

### Security Categories

CodeQL checks for various security issues including:

- **Injection vulnerabilities**: SQL injection, XSS, command injection
- **Authentication issues**: Weak authentication, session management
- **Data exposure**: Sensitive data leaks, improper access control
- **Cryptography**: Weak algorithms, improper key management
- **Code quality**: Complex code, potential bugs, maintainability issues

## Code Metrics

Automated code complexity and metrics calculation helps track code quality trends over time and identify areas that may need refactoring.

### Complexity Analysis

Uses [`complexity-report`](https://www.npmjs.com/package/complexity-report) to calculate:

- **Cyclomatic Complexity**: Number of independent paths through code
- **Halstead Metrics**: Software science metrics for code volume and difficulty
- **Maintainability Index**: Composite metric for code maintainability (0-100 scale)
- **Lines of Code**: Physical and logical lines

### Plato Reports

[Plato](https://github.com/es-analysis/plato) generates detailed code quality reports with:

- Visual complexity graphs
- File-by-file analysis
- Historical trend tracking
- Maintainability scoring
- Interactive HTML reports

### Metrics Tracked

**Project-Level Metrics**

- Total lines of code
- Number of files
- Average complexity per file
- Overall maintainability index

**File-Level Metrics**

- Cyclomatic complexity
- Lines of code (physical/logical)
- Number of functions
- Maintainability index
- Estimated maintenance time

### Accessing Reports

Complexity and Plato reports are generated as artifacts that can be downloaded from:

1. Navigate to **Actions** tab in GitHub
2. Select the **Code Metrics** workflow run
3. Download artifacts from the **Artifacts** section
4. Reports are retained for 30 days

### When Metrics Run

- On push to `main`, `develop`, and `staging` branches
- On pull requests to protected branches
- Can be manually triggered via GitHub Actions
- Scheduled runs can be configured as needed

## Best Practices

To maintain code quality:

1. **Run linting locally** before committing: `npm run lint:biome`
2. **Type check** your changes: `npm run type-check`
3. **Run tests** to ensure nothing breaks: `npm test`
4. **Review security alerts** in the Security tab regularly
5. **Monitor complexity metrics** to avoid over-complicated code
6. **Address warnings** from automated checks promptly

## Interpreting Metrics

### Maintainability Index

- **85-100**: Excellent maintainability
- **65-84**: Good maintainability
- **50-64**: Moderate maintainability
- **0-49**: Difficult to maintain (needs refactoring)

### Cyclomatic Complexity

- **1-10**: Simple, easy to test
- **11-20**: More complex, needs attention
- **21-50**: Very complex, hard to test
- **>50**: Extremely complex, should be refactored

### When to Refactor

Consider refactoring when:

- Maintainability index drops below 65
- Cyclomatic complexity exceeds 15
- File has more than 500 lines of code
- Function has more than 50 lines of code
- Multiple code quality alerts for the same file

## Related Documentation

- [Quality Assurance](qa.md) - Testing methods and QA processes
- [Automations](automations.md) - CI/CD workflows and automation details
- [Security](security.md) - Security practices and vulnerability management

## Tools and Technologies

- **[Biome](https://biomejs.dev/)**: Fast formatter and linter for JavaScript/TypeScript
- **[TypeScript](https://www.typescriptlang.org/)**: Static type checking
- **[CodeQL](https://codeql.github.com/)**: Semantic code analysis
- **[npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit)**: Dependency vulnerability scanning
- **[complexity-report](https://www.npmjs.com/package/complexity-report)**: Code complexity metrics
- **[Plato](https://github.com/es-analysis/plato)**: Code visualization and reporting

