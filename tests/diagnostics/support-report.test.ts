import { describe, expect, it } from "vitest";

import { createSupportReport } from "../../src/diagnostics/support-report";

describe("support report", () => {
  it("uses anonymous central aliases and aggregate runtime facts", () => {
    const report = createSupportReport(
      {
        app: {
          id: "io.github.branselbytes.openccu",
          version: "0.1.0",
          node: "v22.0.0",
        },
        runtimes: [
          {
            centralId: "private-central-name",
            runtime: {
              connectionState: "healthy",
              deviceCount: 12,
              discoveryIssueCount: 1,
              metadataIssueCount: 0,
              systemInformationIssueCount: 0,
              radioInterfaceCount: 1,
              metadataCounts: {
                names: 20,
                rooms: 3,
                functions: 2,
                programs: 4,
                systemVariables: 5,
              },
              transport: {
                activeRequests: 0,
                queuedRequests: 0,
                totalRequests: 30,
                completedRequests: 29,
                failedRequests: 1,
                timedOutRequests: 0,
              },
              devices: [],
            },
          },
        ],
      },
      new Date("2026-09-05T12:00:00.000Z"),
    );

    expect(report).toMatchObject({
      schemaVersion: 2,
      generatedAt: "2026-09-05T12:00:00.000Z",
      centrals: [
        {
          alias: "central-1",
          runtime: { connectionState: "healthy", deviceCount: 12 },
        },
      ],
    });
    expect(JSON.stringify(report)).not.toContain("private-central-name");
  });

  it("redacts sensitive fields if runtime diagnostics are extended later", () => {
    const report = createSupportReport({
      app: { id: "app", version: "1", node: "v22" },
      runtimes: [
        {
          centralId: "ccu",
          runtime: {
            connectionState: "degraded",
            deviceCount: 0,
            discoveryIssueCount: 0,
            metadataIssueCount: 0,
            systemInformationIssueCount: 2,
            radioInterfaceCount: 0,
            metadataCounts: {
              names: 0,
              rooms: 0,
              functions: 0,
              programs: 0,
              systemVariables: 0,
            },
            devices: [],
            host: "192.0.2.1",
            token: "secret-token",
            value: "private-value",
          } as never,
        },
      ],
    });

    expect(report.centrals[0]?.runtime).toMatchObject({
      host: "[Address Redacted]",
      token: "[Redacted]",
      value: "[Value Redacted]",
    });
  });
});
