# Licensing Compliance Report

**Date:** November 20, 2025  
**Project:** DataGems Frontend (`dg-app-ui`)  
**Primary License:** European Union Public Licence v. 1.2 (EUPL-1.2)

---

## 1. Executive Summary

All audited dependencies are compatible with the project's governing license (EUPL-1.2). Production and development packages are distributed under permissive terms (MIT, ISC, BSD, Apache-2.0) that allow sublicensing and integration with the strong copyleft EUPL. No blocking conflicts or remediation actions are required at this time.

---

## 2. Main Project License

| Attribute | Details |
| :--- | :--- |
| License Name | European Union Public Licence v. 1.2 (EUPL-1.2) |
| Repository Location | `./LICENSE` |
| License Type | Strong copyleft |

**Key Obligations**

- **Source availability:** When distributing binaries or hosted services, corresponding source code must be made accessible under EUPL-1.2.  
- **Reciprocity:** Modified or derivative works must retain the EUPL-1.2 (or another license listed as compatible in the EUPL appendix).  
- **Attribution:** All copyright notices and original license texts must be preserved.

---

## 3. Dependency License Breakdown

### 3.1 Production Dependencies

| Package | License | Compatibility |
| :--- | :--- | :--- |
| `next` | MIT | ✅ Compatible |
| `react` | MIT | ✅ Compatible |
| `react-dom` | MIT | ✅ Compatible |
| `maplibre-gl` | BSD-3-Clause | ✅ Compatible |
| `next-auth` | ISC | ✅ Compatible |
| `lucide-react` | ISC | ✅ Compatible |
| `@next/font` | MIT | ✅ Compatible |
| `clsx` | MIT | ✅ Compatible |
| `geist` | MIT | ✅ Compatible |
| `pino` | MIT | ✅ Compatible |
| `pino-pretty` | MIT | ✅ Compatible |
| `tailwind-merge` | MIT | ✅ Compatible |

### 3.2 Development Dependencies

| Package | License | Compatibility |
| :--- | :--- | :--- |
| `typescript` | Apache-2.0 | ✅ Compatible |
| `tailwindcss` | MIT | ✅ Compatible |
| `@biomejs/biome` | MIT / Apache-2.0 | ✅ Compatible |
| `eslint` | MIT | ✅ Compatible |
| `prettier` | MIT | ✅ Compatible |
| `cypress` | MIT | ✅ Compatible |
| `husky` | MIT | ✅ Compatible |
| `lint-staged` | MIT | ✅ Compatible |

---

## 4. Compatibility Analysis

**Compatibility Rationale**

1. Permissive licenses (MIT, ISC, BSD, Apache-2.0) allow use, modification, and redistribution within derivative works, provided attribution is retained.  
2. None of the listed dependencies impose copyleft terms that would conflict with, or exceed, the reciprocity obligations of the EUPL-1.2.  
3. Apache-2.0's patent provisions are compatible with the EUPL-1.2 when the EUPL remains the outbound license.

**Conclusion**

The DataGems Frontend (`dg-app-ui`) can be safely distributed under the EUPL-1.2. All current dependencies align with the project's licensing strategy, and no conflicts or mitigation steps are required. Continue to preserve upstream notices and monitor new dependencies for compatibility in future releases.

