interface DiagnosticsApiContext {
  readonly homey: {
    readonly app: {
      generateSupportReport(): unknown;
    };
  };
}

export = {
  getDiagnostics({ homey }: DiagnosticsApiContext): unknown {
    return homey.app.generateSupportReport();
  },
};
