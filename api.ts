interface DiagnosticsApiContext {
  readonly homey: {
    readonly app: {
      generateSupportReport(): unknown;
      discoverOpenCcus(): Promise<unknown>;
    };
  };
}

export = {
  getDiagnostics({ homey }: DiagnosticsApiContext): unknown {
    return homey.app.generateSupportReport();
  },
  getDiscovery({ homey }: DiagnosticsApiContext): Promise<unknown> {
    return homey.app.discoverOpenCcus();
  },
};
