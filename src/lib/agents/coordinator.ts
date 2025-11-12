/**
 * Coordinator Agent - Orchestrates the multi-agent ESG analysis system
 * Uses Orchestrator-Worker pattern from AI SDK v6
 */

import type { ToolLoopAgent } from "ai";

export interface CoordinatorResults {
  discovery: any;
  emissions: any;
  targets: any;
  investments: any;
  risks: any;
  synthesis: any;
}

export class CoordinatorAgent {
  private discoveryAgent: ToolLoopAgent;
  private emissionsAgent: ToolLoopAgent;
  private targetsAgent: ToolLoopAgent;
  private investmentAgent: ToolLoopAgent;
  private riskAgent: ToolLoopAgent;
  private synthesisAgent: ToolLoopAgent;
  private onProgress?: (message: string) => void;

  private results: CoordinatorResults = {
    discovery: null,
    emissions: null,
    targets: null,
    investments: null,
    risks: null,
    synthesis: null,
  };

  constructor(agents: {
    discoveryAgent: ToolLoopAgent;
    emissionsAgent: ToolLoopAgent;
    targetsAgent: ToolLoopAgent;
    investmentAgent: ToolLoopAgent;
    riskAgent: ToolLoopAgent;
    synthesisAgent: ToolLoopAgent;
    onProgress?: (message: string) => void;
  }) {
    this.discoveryAgent = agents.discoveryAgent;
    this.emissionsAgent = agents.emissionsAgent;
    this.targetsAgent = agents.targetsAgent;
    this.investmentAgent = agents.investmentAgent;
    this.riskAgent = agents.riskAgent;
    this.synthesisAgent = agents.synthesisAgent;
    this.onProgress = agents.onProgress;
  }

  private log(message: string) {
    console.log(message);
    if (this.onProgress) {
      this.onProgress(message);
    }
  }

  /**
   * Run the complete hierarchical ESG analysis
   */
  async runAnalysis(topic = "environmental strategy"): Promise<CoordinatorResults> {
    this.log("\n" + "=".repeat(60));
    this.log(`Starting ESG Analysis: ${topic}`);
    this.log("=".repeat(60) + "\n");

    // Phase 1: Discovery
    this.log("\n[PHASE 1] Discovery - Mapping content locations...");
    this.log("-".repeat(60));
    const discoveryResult = await this.runDiscovery(topic);
    this.results.discovery = discoveryResult;
    this.log("\n✓ Discovery complete");

    // Phase 2: Extraction (parallel execution using Promise.all)
    this.log("\n[PHASE 2] Extraction - Specialized agents extracting data...");
    this.log("-".repeat(60));

    const discoveryContext = this.formatDiscoveryContext(discoveryResult);

    // Run extraction agents in parallel
    const [emissionsResult, targetsResult, investmentResult, riskResult] =
      await Promise.all([
        this.runEmissionsExtraction(discoveryContext),
        this.runTargetsExtraction(discoveryContext),
        this.runInvestmentExtraction(discoveryContext),
        this.runRiskExtraction(discoveryContext),
      ]);

    this.results.emissions = emissionsResult;
    this.results.targets = targetsResult;
    this.results.investments = investmentResult;
    this.results.risks = riskResult;

    this.log("\n✓ All extraction agents complete");

    // Phase 3: Synthesis
    this.log("\n[PHASE 3] Synthesis - Aggregating and analyzing findings...");
    this.log("-".repeat(60));
    const synthesisResult = await this.runSynthesis();
    this.results.synthesis = synthesisResult;
    this.log("\n✓ Synthesis complete");

    this.log("\n" + "=".repeat(60));
    this.log("Analysis Complete!");
    this.log("=".repeat(60) + "\n");

    return this.results;
  }

  /**
   * Phase 1: Discovery
   */
  private async runDiscovery(topic: string) {
    const query = `Analyze the ESG report to create a content map for: ${topic}

Please identify and map the following sections:
1. Emissions data (Scope 1, 2, 3 GHG emissions)
2. Climate targets and commitments (net-zero, interim targets)
3. Investment and capital allocation (renewables, fossil fuels)
4. Climate risks and TCFD disclosures

For each section, provide:
- Section name
- Page range (start and end)
- Brief description of content
- Relevance score (high/medium/low)

Use the available search tools to locate these sections.`;

    this.log("  → Discovery Agent working...");
    const result = await this.discoveryAgent.generate({
      messages: [{ role: "user", content: query }],
    });

    return {
      text: result.text,
      steps: result.steps?.length || 0,
      usage: result.usage,
    };
  }

  /**
   * Phase 2: Emissions Extraction
   */
  private async runEmissionsExtraction(discoveryContext: string) {
    const query = `Based on the discovery phase, extract all GHG emissions data from the report.

Discovery context:
${discoveryContext}

Please extract:
1. Scope 1 emissions (all years available)
2. Scope 2 emissions (market-based and location-based if available)
3. Scope 3 emissions (all categories if detailed)
4. Baseline year and baseline values
5. Year-over-year trends

For each data point, use the structureEmissionsData tool to format the output.
Always cite the page numbers where you found the data.`;

    this.log("  → Emissions Extractor working...");
    const result = await this.emissionsAgent.generate({
      messages: [{ role: "user", content: query }],
    });

    this.log("  ✓ Emissions extraction complete");

    return {
      text: result.text,
      steps: result.steps?.length || 0,
      usage: result.usage,
    };
  }

  /**
   * Phase 2: Targets Extraction
   */
  private async runTargetsExtraction(discoveryContext: string) {
    const query = `Based on the discovery phase, extract all climate targets and commitments.

Discovery context:
${discoveryContext}

Please extract:
1. Net-zero target (year, scope coverage)
2. Carbon neutrality commitments
3. All interim targets (2030, 2035, 2040, etc.)
4. Science-Based Targets (SBTi) alignment
5. Renewable energy targets
6. Any caveats or exclusions

For each target, use the structureTargetData tool to format the output.
Always cite page numbers.`;

    this.log("  → Targets Extractor working...");
    const result = await this.targetsAgent.generate({
      messages: [{ role: "user", content: query }],
    });

    this.log("  ✓ Targets extraction complete");

    return {
      text: result.text,
      steps: result.steps?.length || 0,
      usage: result.usage,
    };
  }

  /**
   * Phase 2: Investment Extraction
   */
  private async runInvestmentExtraction(discoveryContext: string) {
    const query = `Based on the discovery phase, extract investment and capital allocation data.

Discovery context:
${discoveryContext}

Please extract:
1. Renewable energy CapEx (by technology: solar, wind, hydro, etc.)
2. Fossil fuel investments (gas, coal)
3. Grid and infrastructure spending
4. R&D on low-carbon technologies
5. Total CapEx and allocation percentages
6. Any divestment plans

For each investment, use the structureInvestmentData tool to format the output.
Always cite page numbers.`;

    this.log("  → Investment Extractor working...");
    const result = await this.investmentAgent.generate({
      messages: [{ role: "user", content: query }],
    });

    this.log("  ✓ Investment extraction complete");

    return {
      text: result.text,
      steps: result.steps?.length || 0,
      usage: result.usage,
    };
  }

  /**
   * Phase 2: Risk Extraction
   */
  private async runRiskExtraction(discoveryContext: string) {
    const query = `Based on the discovery phase, extract climate risk assessments.

Discovery context:
${discoveryContext}

Please extract:
1. Physical climate risks (floods, droughts, extreme weather)
2. Transition risks (policy, technology, market shifts)
3. TCFD disclosures
4. Scenario analysis (1.5°C, 2°C scenarios if performed)
5. Mitigation strategies
6. Financial impact estimates

For each risk, use the structureRiskData tool to format the output.
Always cite page numbers.`;

    this.log("  → Risk Extractor working...");
    const result = await this.riskAgent.generate({
      messages: [{ role: "user", content: query }],
    });

    this.log("  ✓ Risk extraction complete");

    return {
      text: result.text,
      steps: result.steps?.length || 0,
      usage: result.usage,
    };
  }

  /**
   * Phase 3: Synthesis
   */
  private async runSynthesis() {
    const allFindings = `Create a comprehensive, in-depth ESG environmental strategy analysis report based on the following findings from specialized agents:

EMISSIONS DATA:
${this.formatAgentResult(this.results.emissions)}

TARGETS DATA:
${this.formatAgentResult(this.results.targets)}

INVESTMENTS DATA:
${this.formatAgentResult(this.results.investments)}

RISKS DATA:
${this.formatAgentResult(this.results.risks)}

CRITICAL INSTRUCTIONS:

1. **MANDATORY MARKDOWN FORMATTING**: Your output MUST use proper markdown syntax:
   - Start with "# Executive Summary" (note the # symbol with space)
   - Use "## Key Findings", "## Main Concerns" for subsections
   - Use "### Emissions Performance" for detailed topics
   - Use "**bold**" for emphasis and "- bullet points" for lists
   - Example first line: "# Executive Summary"

   **DO NOT output plain text without markdown headers!**

2. **Deep Quantitative Analysis**: Extract ALL specific metrics, figures, and data points from the findings above. Include:
   - Exact emission values with units (Mt CO2e)
   - Financial amounts with currency (€, $) and years
   - Percentages, ratios, and growth rates
   - Year-over-year changes and trend calculations
   - Time-series progressions

3. **No Meta-Commentary or Interactivity**:
   - Start DIRECTLY with "# Executive Summary"
   - NO phrases like "Below is an aggregated synthesis..."
   - NO questions like "Which of these would you like me to prepare?"
   - NO template offers or suggestions for follow-up work
   - This is a FINAL, STANDALONE report

4. **Proper Citations**: Use [Page X], [Pages X–Y], or [Pages X, Y, Z] format immediately after EVERY claim

5. **Critical Analysis**:
   - Calculate derived metrics (e.g., annual reduction rates, CapEx splits)
   - Cross-reference data for consistency checks
   - Identify specific gaps in disclosure
   - Assess credibility with numerical evidence
   - Flag greenwashing with concrete examples

6. **Professional Structure**: Follow the complete structure in your system prompt with MARKDOWN FORMATTING:
   - Executive Summary (Key Findings, Main Concerns)
   - Detailed Analysis (Emissions, Targets, Investments, Risks with subsections)
   - Cross-Cutting Analysis (Consistency, Gaps, Credibility)
   - Conclusion (3-4 paragraphs, no interactive prompts)

   **Remember: Every section must start with # or ## or ### markdown headers!**

7. **Use ALL Available Data**: Mine the extraction findings thoroughly. Don't leave out metrics or details.

This report will be read by institutional investors and stakeholders. Make it rigorous, quantitative, and actionable.`;

    this.log("  → Synthesis Agent working...");
    const result = await this.synthesisAgent.generate({
      messages: [{ role: "user", content: allFindings }],
    });

    return {
      text: result.text,
      steps: result.steps?.length || 0,
      usage: result.usage,
    };
  }

  /**
   * Helper: Format discovery context for extraction agents
   */
  private formatDiscoveryContext(discoveryResult: any): string {
    const text = discoveryResult.text || "";
    // Truncate to avoid context window issues
    return text.length > 2000 ? text.substring(0, 2000) + "..." : text;
  }

  /**
   * Helper: Format agent result for synthesis
   */
  private formatAgentResult(result: any): string {
    return result?.text || "No data available";
  }

  /**
   * Get the results
   */
  getResults(): CoordinatorResults {
    return this.results;
  }

  /**
   * Get formatted final result for storage
   * Returns only the synthesis (final phase) for display
   */
  getFormattedResult(): string {
    if (this.results.synthesis) {
      return this.results.synthesis.text || "Analysis completed with no content";
    }
    return "Analysis incomplete";
  }

  /**
   * Get intermediate results as JSON for database storage
   */
  getIntermediateResults(): string {
    return JSON.stringify({
      discovery: this.results.discovery,
      emissions: this.results.emissions,
      targets: this.results.targets,
      investments: this.results.investments,
      risks: this.results.risks,
    }, null, 2);
  }
}
