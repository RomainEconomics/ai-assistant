/**
 * DeepAgent configurations
 * Defines different agent types with their system prompts and metadata
 */

export interface DeepAgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  defaultQuery?: string;
  estimatedDuration?: string; // e.g., "5-10 minutes"
}

/**
 * ESG Environmental Strategy Agent - Comprehensive hierarchical analysis
 * Uses AI SDK v6 multi-agent system (Discovery → Extraction → Synthesis)
 */
export const ESG_ENVIRONMENTAL_AGENT: DeepAgentConfig = {
  id: "esg-environmental",
  name: "ESG Environmental Strategy Analyst",
  description: "Expert ESG analyst using a hierarchical multi-agent system for comprehensive environmental and climate strategy analysis from corporate sustainability reports. Powered by AI SDK v6 with specialized agents for discovery, data extraction, and synthesis.",
  estimatedDuration: "10-15 minutes",
  systemPrompt: `You are coordinating a hierarchical multi-agent system for ESG analysis.

## System Architecture

This is a three-phase hierarchical analysis system:

**Phase 1: Discovery Agent**
- Maps document structure and locates relevant sections
- Identifies page ranges for emissions, targets, investments, and risks
- Creates a content map for downstream agents

**Phase 2: Extraction Agents (Parallel Execution)**
Four specialized agents work in parallel:
- Emissions Extractor: GHG emissions data (Scope 1, 2, 3)
- Targets Extractor: Climate targets and commitments
- Investment Extractor: CapEx allocation and energy transition finance
- Risk Extractor: Climate risks and TCFD disclosures

**Phase 3: Synthesis Agent**
- Aggregates findings from all extraction agents
- Performs trend analysis and consistency checks
- Identifies gaps and greenwashing indicators
- Produces final comprehensive assessment

## Your Role

You are the coordinator orchestrating these agents to produce a thorough analysis of corporate environmental strategy.

The system will automatically:
1. Discover relevant content locations
2. Extract quantitative data with page citations
3. Synthesize findings into a coherent assessment

Results will include:
- Executive summary with key findings
- Detailed data on emissions, targets, investments, and risks
- Trend analysis and credibility assessment
- Gap analysis and critical evaluation`,
  defaultQuery: `Conduct a comprehensive analysis of the company's environmental strategy and climate action.

Your analysis should cover:

1. **GHG Emissions Performance**
   - Extract Scope 1, 2, and 3 emissions for all available years
   - Identify baseline year and calculate trends
   - Assess whether emissions are decreasing and at what rate

2. **Climate Targets & Commitments**
   - Identify net-zero and carbon neutrality targets (years and scope coverage)
   - Extract all interim reduction targets (2030, 2035, 2040, etc.)
   - Assess SBTi alignment and credibility of commitments

3. **Energy Transition Investments**
   - Extract CapEx allocation for renewables vs. fossil fuels
   - Identify specific renewable energy projects and capacity additions
   - Assess alignment between investments and stated climate targets

4. **Climate Risk Assessment**
   - Identify physical and transition risks disclosed
   - Assess TCFD compliance and completeness
   - Extract any scenario analysis or stress testing performed

5. **Critical Assessment & Synthesis**
   - Are targets ambitious enough for 1.5°C alignment?
   - Do investments match stated commitments?
   - What are the main data gaps or red flags?
   - Is the company's climate strategy credible and comprehensive?

**Requirements:**
- Cite page numbers for ALL data points
- Calculate year-over-year trends where applicable
- Identify inconsistencies or gaps in disclosure
- Provide both quantitative findings and qualitative assessment
- Flag any potential greenwashing indicators

Organize your response with clear sections and provide an executive summary at the end with 3-5 key findings and main concerns.`,
};

/**
 * All available agent configurations
 */
export const AGENT_CONFIGS: DeepAgentConfig[] = [
  ESG_ENVIRONMENTAL_AGENT,
];

/**
 * Get agent configuration by ID
 */
export function getAgentConfig(id: string): DeepAgentConfig | undefined {
  return AGENT_CONFIGS.find((config) => config.id === id);
}
