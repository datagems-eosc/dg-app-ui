# Quality Assurance

Key aspects of the Quality Assurance checklist that DataGEMS services must pass have been defined in the processes and documents governing the platform development and quality assurance. In this section we present a selected subset of these that are directly, publicly available.

## Code Analysis

Static code analysis is the process of examining source code without executing it, to identify potential errors, vulnerabilities, or deviations from coding standards. It is typically performed using tools that analyze the code's structure, syntax, and logic to detect issues such as bugs, security flaws, or maintainability problems early in the development cycle. This helps improve code quality, reduce technical debt, and ensure compliance with best practices before the software is run or deployed.

Static code analysis is a process that has been tied with the development and release lifecycle through the configured GitHub Actions workflow that performs security, quality and maintenability of the code base. The workflow is described in the relevant [Automations](automations.md) section.

## Code Metrics

Code metrics are quantitative measurements used to assess various aspects of source code quality and complexity. They help developers understand how maintainable, efficient, and error-prone a codebase might be. Common code metrics include lines of code (LOC), cyclomatic complexity, maintenability index, and coupling levels. By analyzing these metrics, teams can identify potential issues, enforce coding standards, and improve overall software quality throughout the development lifecycle.

The service has configured an automated GitHub Actions workflow, as described in the relevant [Automations](automations.md) section to calculate such metrics.

## Vulnerability checks

Vulnerability checks are processes used to identify known security weaknesses in software, libraries, or dependencies. These checks typically scan the codebase, configuration files, or external packages against databases of publicly disclosed vulnerabilities. By detecting issues such as outdated libraries, insecure functions, or misconfigurations, vulnerability checks help developers address security risks early and maintain a secure software environment.

The service has configured an automated GitHub Actions workflow, as described in the relevant [Automations](automations.md) section to perform such checks on the versioned artefacts.

## Testing

**TODO: Describe the process**
