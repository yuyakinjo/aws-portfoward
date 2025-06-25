export interface PerformanceMetrics {
  step: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export class PerformanceTracker {
  private metrics: PerformanceMetrics[] = [];
  private currentStep: string | null = null;
  private stepStartTime: number | null = null;

  startStep(step: string): void {
    if (this.currentStep) {
      this.endStep();
    }
    this.currentStep = step;
    this.stepStartTime = performance.now();
  }

  endStep(): void {
    if (this.currentStep && this.stepStartTime !== null) {
      const endTime = performance.now();
      this.metrics.push({
        step: this.currentStep,
        startTime: this.stepStartTime,
        endTime,
        duration: endTime - this.stepStartTime,
      });
      this.currentStep = null;
      this.stepStartTime = null;
    }
  }

  getMetrics(): PerformanceMetrics[] {
    if (this.currentStep) {
      this.endStep();
    }
    return [...this.metrics];
  }

  getTotalDuration(): number {
    return this.metrics.reduce((total, metric) => total + metric.duration, 0);
  }

  getReport(): string {
    const metrics = this.getMetrics();
    const total = this.getTotalDuration();

    const reportLines = ["\n🕐 Performance Report\n", `${"=".repeat(50)}\n`];

    for (const metric of metrics) {
      const percentage =
        total > 0 ? ((metric.duration / total) * 100).toFixed(1) : "0.0";
      reportLines.push(
        `${metric.step.padEnd(30)} ${metric.duration.toFixed(0).padStart(6)}ms (${percentage}%)\n`,
      );
    }

    reportLines.push(
      `${"=".repeat(50)}\n`,
      `${"Total".padEnd(30)} ${total.toFixed(0).padStart(6)}ms (100.0%)\n`,
    );

    if (total > 3000) {
      reportLines.push("\nWarning: Total time exceeds 3 seconds threshold\n");
    } else {
      reportLines.push("\nPerformance within acceptable range (<3s)\n");
    }

    const report = reportLines.join("");

    return report;
  }
}
