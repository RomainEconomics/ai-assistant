# System Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Browser]
        React[React 19 App]
        TanStack[TanStack Query]
        UI[shadcn/ui Components]
    end

    subgraph "Server Layer - Bun Runtime"
        BunServe[Bun.serve API Server]

        subgraph "API Endpoints"
            ProjectsAPI[Projects API]
            ConversationsAPI[Conversations API]
            ChatAPI[Chat API]
            SettingsAPI[Settings API]
            DocumentsAPI[Documents API]
            RAGAPI[RAG API]
            DeepAgentAPI[DeepAgent API]
        end

        subgraph "Workers"
            PDFWorker[PDF Worker Thread]
            DeepAgentWorker[DeepAgent Worker]
        end
    end

    subgraph "AI Layer"
        AISDKv6[AI SDK v6]
        OpenAI[OpenAI API<br/>GPT-4o, GPT-4o-mini]
        Anthropic[Anthropic API<br/>Claude 3.5 Sonnet]

        subgraph "DeepAgent System"
            DiscoveryAgent[Discovery Agent<br/>Document Mapping]
            ExtractionAgents[Extraction Agents<br/>Parallel Processing]
            SynthesisAgent[Synthesis Agent<br/>Final Analysis]
        end
    end

    subgraph "Data Layer"
        SQLite[(SQLite Database<br/>users, projects,<br/>conversations,<br/>messages, agent_runs)]

        Weaviate[(Weaviate Vector DB<br/>ParentDocument,<br/>ChildDocument)]

        S3[S3 Storage<br/>PDF Documents]
    end

    subgraph "Processing Pipeline"
        Upload[PDF Upload]
        Extract[Text Extraction<br/>pdf-parse]
        Chunk[Text Chunking<br/>1000 chars + 200 overlap]
        Embed[Embeddings<br/>text-embedding-3-small]
        Store[Store in Weaviate]
    end

    %% Client connections
    Browser --> React
    React --> UI
    React --> TanStack
    TanStack --> BunServe

    %% API routing
    BunServe --> ProjectsAPI
    BunServe --> ConversationsAPI
    BunServe --> ChatAPI
    BunServe --> SettingsAPI
    BunServe --> DocumentsAPI
    BunServe --> RAGAPI
    BunServe --> DeepAgentAPI

    %% AI connections
    ChatAPI --> AISDKv6
    AISDKv6 --> OpenAI
    AISDKv6 --> Anthropic

    DeepAgentAPI --> DeepAgentWorker
    DeepAgentWorker --> DiscoveryAgent
    DiscoveryAgent --> ExtractionAgents
    ExtractionAgents --> SynthesisAgent
    DiscoveryAgent -.->|Uses Tools| Weaviate
    ExtractionAgents -.->|Uses Tools| Weaviate
    SynthesisAgent -.->|Uses Tools| Weaviate

    %% Database connections
    ProjectsAPI --> SQLite
    ConversationsAPI --> SQLite
    ChatAPI --> SQLite
    SettingsAPI --> SQLite
    DocumentsAPI --> SQLite
    DeepAgentAPI --> SQLite
    RAGAPI --> Weaviate
    RAGAPI --> SQLite
    DocumentsAPI --> S3

    %% Processing pipeline
    DocumentsAPI --> PDFWorker
    PDFWorker --> Upload
    Upload --> Extract
    Extract --> Chunk
    Chunk --> S3
    Chunk --> Embed
    Embed --> Store
    Store --> Weaviate

    %% Styling
    classDef clientStyle fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef serverStyle fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef aiStyle fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef dataStyle fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef processStyle fill:#fff8e1,stroke:#f57f17,stroke-width:2px

    class Browser,React,TanStack,UI clientStyle
    class BunServe,ProjectsAPI,ConversationsAPI,ChatAPI,SettingsAPI,DocumentsAPI,RAGAPI,DeepAgentAPI,PDFWorker,DeepAgentWorker serverStyle
    class AISDKv6,OpenAI,Anthropic,DiscoveryAgent,ExtractionAgents,SynthesisAgent aiStyle
    class SQLite,Weaviate,S3 dataStyle
    class Upload,Extract,Chunk,Embed,Store processStyle
```

## Data Flow Examples

### 1. Simple Chat Flow
```mermaid
sequenceDiagram
    participant User
    participant React
    participant ChatAPI
    participant AISDKv6
    participant OpenAI/Anthropic
    participant SQLite

    User->>React: Send message
    React->>ChatAPI: POST /api/chat/stream
    ChatAPI->>SQLite: Save user message
    ChatAPI->>AISDKv6: streamText()
    AISDKv6->>OpenAI/Anthropic: API request
    OpenAI/Anthropic-->>AISDKv6: Stream response
    AISDKv6-->>ChatAPI: Stream chunks
    ChatAPI-->>React: Server-Sent Events
    React-->>User: Display streaming response
    ChatAPI->>SQLite: Save assistant message
```

### 2. PDF Processing Flow
```mermaid
sequenceDiagram
    participant User
    participant DocumentsAPI
    participant PDFWorker
    participant S3
    participant Weaviate
    participant SQLite

    User->>DocumentsAPI: Upload PDF
    DocumentsAPI->>PDFWorker: Spawn worker thread

    par PDF Processing
        PDFWorker->>PDFWorker: Extract text per page
        PDFWorker->>S3: Upload PDF file
        S3-->>PDFWorker: S3 URL & key
    end

    loop For each page
        PDFWorker->>PDFWorker: Chunk text
        PDFWorker->>Weaviate: Insert ParentDocument
        loop For each chunk
            PDFWorker->>Weaviate: Insert ChildDocument<br/>with embeddings
        end
    end

    PDFWorker->>SQLite: Save document metadata
    PDFWorker-->>DocumentsAPI: Processing complete
    DocumentsAPI-->>User: Success response
```

### 3. DeepAgent Analysis Flow
```mermaid
sequenceDiagram
    participant User
    participant DeepAgentAPI
    participant DeepAgentWorker
    participant DiscoveryAgent
    participant ExtractionAgents
    participant SynthesisAgent
    participant Weaviate
    participant SQLite

    User->>DeepAgentAPI: Start analysis
    DeepAgentAPI->>SQLite: Create agent_run (status: running)
    DeepAgentAPI->>DeepAgentWorker: Spawn worker
    DeepAgentAPI-->>User: Return run_id

    rect rgb(230, 240, 255)
        Note over DeepAgentWorker,Weaviate: Phase 1: Discovery
        DeepAgentWorker->>DiscoveryAgent: Map document structure
        DiscoveryAgent->>Weaviate: Search & retrieve pages
        Weaviate-->>DiscoveryAgent: Document sections
        DiscoveryAgent-->>DeepAgentWorker: Discovery context
    end

    rect rgb(255, 240, 230)
        Note over DeepAgentWorker,Weaviate: Phase 2: Extraction (Parallel)
        par Parallel Extraction
            DeepAgentWorker->>ExtractionAgents: Emissions Extractor
            DeepAgentWorker->>ExtractionAgents: Targets Extractor
            DeepAgentWorker->>ExtractionAgents: Investment Extractor
            DeepAgentWorker->>ExtractionAgents: Risk Extractor
        end
        ExtractionAgents->>Weaviate: Search specific sections
        Weaviate-->>ExtractionAgents: Relevant data
        ExtractionAgents-->>DeepAgentWorker: Extraction results
    end

    rect rgb(230, 255, 230)
        Note over DeepAgentWorker,SynthesisAgent: Phase 3: Synthesis
        DeepAgentWorker->>SynthesisAgent: Aggregate findings
        SynthesisAgent->>SynthesisAgent: Trend analysis<br/>Gap identification<br/>Critical assessment
        SynthesisAgent-->>DeepAgentWorker: Final report
    end

    DeepAgentWorker->>SQLite: Update agent_run<br/>(status: completed, result)

    loop User polling
        User->>DeepAgentAPI: GET /api/deepagent/runs/:id
        DeepAgentAPI->>SQLite: Query run status
        SQLite-->>DeepAgentAPI: Run data
        DeepAgentAPI-->>User: Status update
    end
```

### 4. RAG Query Flow
```mermaid
sequenceDiagram
    participant User
    participant RAGAPI
    participant Weaviate
    participant SQLite
    participant OpenAI

    User->>RAGAPI: Ask question about document
    RAGAPI->>OpenAI: Generate query embedding
    OpenAI-->>RAGAPI: Query vector
    RAGAPI->>Weaviate: Hybrid search on ChildDocument
    Weaviate-->>RAGAPI: Top N relevant chunks
    RAGAPI->>Weaviate: Retrieve ParentDocument pages
    Weaviate-->>RAGAPI: Full page context
    RAGAPI->>RAGAPI: Build context with page citations
    RAGAPI->>OpenAI: Generate answer with context
    OpenAI-->>RAGAPI: Answer with [Page X] references
    RAGAPI->>SQLite: Save query history
    RAGAPI-->>User: Answer with clickable page links
```

## Key Architecture Patterns

### 1. Parent/Child RAG Strategy
- **ChildDocument**: Small chunks (1000 chars) with embeddings for semantic search
- **ParentDocument**: Full pages without embeddings for context retrieval
- **Benefit**: Fast semantic search + comprehensive context

### 2. Worker Thread Pattern
- Long-running tasks (PDF processing, DeepAgent) run in separate threads
- Prevents HTTP timeouts
- Enables real-time progress polling
- Non-blocking server operation

### 3. Hierarchical Multi-Agent System
- **Phase 1**: Discovery agent maps document structure
- **Phase 2**: Specialized extractors run in parallel
- **Phase 3**: Synthesis agent aggregates and analyzes
- **Benefit**: Comprehensive analysis with parallelization

### 4. Streaming Architecture
- AI responses stream via Server-Sent Events (SSE)
- Real-time UI updates
- Automatic message persistence
- Better user experience for long responses

### 5. API Proxy Pattern
- PDFs accessed via `/api/documents/:id/pdf` (not direct S3 URLs)
- Server-side authentication
- Proper CORS handling
- Client-side caching
