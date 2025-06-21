/**
 * Build Performance Profiler
 * Monitors build performance, memory usage, and identifies bottlenecks
 */

const os = require('os');
const fs = require('fs').promises;
const path = require('path');

class BuildProfiler {
  constructor() {
    this.startTime = null;
    this.endTime = null;
    this.phases = new Map();
    this.currentPhase = null;
    this.memorySnapshots = [];
    this.fileProcessingTimes = [];
    this.bottlenecks = [];
    this.metrics = {
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      errorFiles: 0,
      totalSize: 0,
      averageFileSize: 0,
      maxFileSize: 0,
      minFileSize: Infinity
    };
  }

  /**
   * Start profiling
   */
  start() {
    this.startTime = Date.now();
    this.takeMemorySnapshot('build_start');
    console.log('🔍 Build profiling started');
  }

  /**
   * End profiling
   */
  end() {
    this.endTime = Date.now();
    this.takeMemorySnapshot('build_end');
    
    if (this.currentPhase) {
      this.endPhase();
    }
    
    console.log('🔍 Build profiling completed');
  }

  /**
   * Start a new phase
   */
  startPhase(name, description = '') {
    if (this.currentPhase) {
      this.endPhase();
    }
    
    this.currentPhase = {
      name,
      description,
      startTime: Date.now(),
      startMemory: process.memoryUsage(),
      operations: 0
    };
    
    console.log(`📊 Phase started: ${name}`);
  }

  /**
   * End current phase
   */
  endPhase() {
    if (!this.currentPhase) return;
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    
    const phaseData = {
      ...this.currentPhase,
      endTime,
      endMemory,
      duration: endTime - this.currentPhase.startTime,
      memoryDelta: {
        rss: endMemory.rss - this.currentPhase.startMemory.rss,
        heapUsed: endMemory.heapUsed - this.currentPhase.startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - this.currentPhase.startMemory.heapTotal
      }
    };
    
    this.phases.set(this.currentPhase.name, phaseData);
    console.log(`📊 Phase completed: ${this.currentPhase.name} (${phaseData.duration}ms)`);
    
    // Check for potential bottlenecks
    if (phaseData.duration > 5000) { // 5 seconds
      this.bottlenecks.push({
        type: 'slow_phase',
        phase: this.currentPhase.name,
        duration: phaseData.duration,
        severity: phaseData.duration > 30000 ? 'high' : 'medium'
      });
    }
    
    if (phaseData.memoryDelta.heapUsed > 100 * 1024 * 1024) { // 100MB
      this.bottlenecks.push({
        type: 'memory_spike',
        phase: this.currentPhase.name,
        memoryIncrease: phaseData.memoryDelta.heapUsed,
        severity: phaseData.memoryDelta.heapUsed > 500 * 1024 * 1024 ? 'high' : 'medium'
      });
    }
    
    this.currentPhase = null;
  }

  /**
   * Increment operation counter for current phase
   */
  incrementOperations() {
    if (this.currentPhase) {
      this.currentPhase.operations++;
    }
  }

  /**
   * Record file processing time
   */
  recordFileProcessing(filePath, startTime, endTime, size) {
    const duration = endTime - startTime;
    
    this.fileProcessingTimes.push({
      filePath,
      duration,
      size,
      throughput: size / duration // bytes per ms
    });
    
    // Update metrics
    this.metrics.processedFiles++;
    this.metrics.totalSize += size;
    this.metrics.maxFileSize = Math.max(this.metrics.maxFileSize, size);
    this.metrics.minFileSize = Math.min(this.metrics.minFileSize, size);
    this.metrics.averageFileSize = this.metrics.totalSize / this.metrics.processedFiles;
    
    // Check for slow file processing
    if (duration > 1000) { // 1 second
      this.bottlenecks.push({
        type: 'slow_file',
        filePath,
        duration,
        size,
        severity: duration > 5000 ? 'high' : 'medium'
      });
    }
    
    this.incrementOperations();
  }

  /**
   * Record skipped file
   */
  recordSkippedFile() {
    this.metrics.skippedFiles++;
    this.incrementOperations();
  }

  /**
   * Record error file
   */
  recordErrorFile() {
    this.metrics.errorFiles++;
    this.incrementOperations();
  }

  /**
   * Take memory snapshot
   */
  takeMemorySnapshot(label) {
    const memoryUsage = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };
    
    this.memorySnapshots.push({
      label,
      timestamp: Date.now(),
      process: memoryUsage,
      system: systemMemory,
      cpuUsage: process.cpuUsage()
    });
  }

  /**
   * Get performance report
   */
  getReport() {
    const totalDuration = this.endTime - this.startTime;
    const phases = Array.from(this.phases.values());
    
    // Calculate throughput
    const filesPerSecond = (this.metrics.processedFiles / totalDuration) * 1000;
    const bytesPerSecond = (this.metrics.totalSize / totalDuration) * 1000;
    
    // Find slowest files
    const slowestFiles = this.fileProcessingTimes
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);
    
    // Find memory peaks
    const memoryPeak = this.memorySnapshots.reduce((peak, snapshot) => {
      if (!snapshot.process) return peak;
      return snapshot.process.heapUsed > peak.heapUsed ? snapshot.process : peak;
    }, { heapUsed: 0 });
    
    return {
      summary: {
        totalDuration,
        totalFiles: this.metrics.totalFiles,
        processedFiles: this.metrics.processedFiles,
        skippedFiles: this.metrics.skippedFiles,
        errorFiles: this.metrics.errorFiles,
        filesPerSecond: Math.round(filesPerSecond * 100) / 100,
        bytesPerSecond: Math.round(bytesPerSecond),
        averageFileSize: Math.round(this.metrics.averageFileSize),
        maxFileSize: this.metrics.maxFileSize,
        memoryPeakMB: Math.round(memoryPeak.heapUsed / 1024 / 1024)
      },
      phases: phases.map(phase => ({
        name: phase.name,
        description: phase.description,
        duration: phase.duration,
        operations: phase.operations,
        operationsPerSecond: Math.round((phase.operations / phase.duration) * 1000),
        memoryDeltaMB: Math.round(phase.memoryDelta.heapUsed / 1024 / 1024)
      })),
      bottlenecks: this.bottlenecks,
      slowestFiles,
      memoryUsage: this.memorySnapshots,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Check for memory issues
    const memoryPeak = this.memorySnapshots.reduce((peak, snapshot) => {
      return snapshot.process && snapshot.process.heapUsed > peak ? snapshot.process.heapUsed : peak;
    }, 0);
    
    if (memoryPeak > 1024 * 1024 * 1024) { // 1GB
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: 'Memory usage exceeded 1GB. Consider implementing streaming for large files.',
        action: 'Implement streaming file processing for files larger than 10MB'
      });
    }
    
    // Check for slow phases
    const slowPhases = Array.from(this.phases.values()).filter(phase => phase.duration > 10000);
    if (slowPhases.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: `${slowPhases.length} phases took longer than 10 seconds.`,
        action: 'Consider parallelizing slow phases or optimizing algorithms'
      });
    }
    
    // Check file processing efficiency
    if (this.metrics.processedFiles > 0) {
      const avgProcessingTime = this.fileProcessingTimes.reduce((sum, file) => sum + file.duration, 0) / this.fileProcessingTimes.length;
      if (avgProcessingTime > 100) { // 100ms per file
        recommendations.push({
          type: 'throughput',
          priority: 'medium',
          message: 'Average file processing time is slow.',
          action: 'Optimize markdown processing or increase parallel workers'
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Save report to file
   */
  async saveReport(outputPath) {
    const report = this.getReport();
    const reportJson = JSON.stringify(report, null, 2);
    
    await fs.writeFile(outputPath, reportJson, 'utf-8');
    console.log(`📊 Performance report saved to: ${outputPath}`);
  }

  /**
   * Print summary to console
   */
  printSummary() {
    const report = this.getReport();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 BUILD PERFORMANCE SUMMARY');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Duration: ${report.summary.totalDuration}ms`);
    console.log(`📁 Files Processed: ${report.summary.processedFiles}`);
    console.log(`⚡ Throughput: ${report.summary.filesPerSecond} files/sec`);
    console.log(`💾 Memory Peak: ${report.summary.memoryPeakMB}MB`);
    
    if (report.bottlenecks.length > 0) {
      console.log('\n⚠️  BOTTLENECKS DETECTED:');
      report.bottlenecks.forEach(bottleneck => {
        console.log(`   - ${bottleneck.type}: ${bottleneck.phase || bottleneck.filePath} (${bottleneck.severity} severity)`);
      });
    }
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      report.recommendations.forEach(rec => {
        console.log(`   - [${rec.priority.toUpperCase()}] ${rec.message}`);
        console.log(`     Action: ${rec.action}`);
      });
    }
    
    console.log('='.repeat(60));
  }
}

module.exports = BuildProfiler;