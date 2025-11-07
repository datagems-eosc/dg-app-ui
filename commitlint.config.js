module.exports = {
  parserPreset: {
    parserOpts: {
      headerPattern: /^(DG-\d+)\s*\|\s*(.+)$/,
      headerCorrespondence: ["ticket", "subject"],
    },
  },
  rules: {
    "header-match-pattern": [2, "always"],
    "ticket-empty": [2, "never"],
    "subject-empty": [2, "never"],
    "subject-min-length": [2, "always", 3],
  },
  plugins: [
    {
      rules: {
        "header-match-pattern": (parsed) => {
          const { header } = parsed;
          const pattern = /^DG-\d+\s*\|\s*.+$/;
          if (!pattern.test(header)) {
            return [
              false,
              "Commit message must match pattern: DG-XX | message",
            ];
          }
          return [true, ""];
        },
        "ticket-empty": (parsed) => {
          const { ticket } = parsed;
          if (!ticket) {
            return [false, "Task number (DG-XX) is required"];
          }
          return [true, ""];
        },
        "subject-empty": (parsed) => {
          const { subject } = parsed;
          if (!subject || subject.trim().length === 0) {
            return [false, "Commit message cannot be empty"];
          }
          return [true, ""];
        },
        "subject-min-length": (parsed) => {
          const { subject } = parsed;
          if (subject && subject.trim().length < 3) {
            return [false, "Commit message must be at least 3 characters"];
          }
          return [true, ""];
        },
      },
    },
  ],
};
