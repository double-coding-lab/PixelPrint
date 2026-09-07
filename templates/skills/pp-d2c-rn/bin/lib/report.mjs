// 同步副本:主本 templates/skills/pp-d2c/bin/lib/report.mjs,上游修复须同步搬运
export function makeReport({ checked, skipped, violations, warnings }) {
  const failed = Array.from(new Set(violations.map((v) => v.rule)));
  const passed = checked.filter((r) => !failed.includes(r) && !skipped.includes(r));
  return {
    ok: violations.length === 0,
    checked,
    skipped,
    passed,
    failed,
    violations,
    warnings,
  };
}

export function printReport(report) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
