export class Disposables {
  private callbacks: (() => void)[] = [];
  add(cleanup: () => void) { this.callbacks.push(cleanup); return cleanup; }
  dispose() {
    const errors: unknown[] = [];
    for (const cleanup of this.callbacks.splice(0).reverse()) {
      try { cleanup(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Cleanup failed");
  }
}
