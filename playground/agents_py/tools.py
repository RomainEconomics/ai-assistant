"""Shared tools for ESG agent system."""

from langchain.tools import tool
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings


class ChromaDBTools:
    """Tools for interacting with the ChromaDB vector store."""

    def __init__(
        self,
        persist_directory: str = "./pdf_db",
        collection_name: str = "pdf_collection",
    ):
        """Initialize ChromaDB connection."""
        self.embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
        self.vector_store = Chroma(
            collection_name=collection_name,
            embedding_function=self.embeddings,
            persist_directory=persist_directory,
        )

    def create_tools(self) -> list:
        """Create all tools for the agent system."""

        @tool
        def semantic_search(query: str, k: int = 5) -> str:
            """Search the document using semantic similarity.

            Args:
                query: The search query to find relevant content
                k: Number of results to return (default: 5)

            Returns:
                Formatted search results with page numbers and content
            """
            results = self.vector_store.similarity_search(query, k=k)

            if not results:
                return "No results found for the query."

            output = f"Found {len(results)} relevant passages:\n\n"
            for i, res in enumerate(results, 1):
                page = res.metadata.get("page", "unknown")
                content = (
                    res.page_content[:300] + "..."
                    if len(res.page_content) > 300
                    else res.page_content
                )
                output += f"{i}. [Page {page}]\n{content}\n\n"

            return output

        @tool
        def get_document_pages(pages: list[int]) -> str:
            """Get full content from specific document pages.

            Args:
                pages: List of page numbers to retrieve

            Returns:
                Full content of the requested pages
            """
            if not pages:
                return "No pages specified."

            if len(pages) == 1:
                context = self.vector_store.get(where={"page": pages[0]})
            else:
                context = self.vector_store.get(
                    where={"$or": [{"page": i} for i in pages]}
                )

            if not context["documents"]:
                return f"No content found for pages: {pages}"

            text = ""
            for doc, metadata in zip(context["documents"], context["metadatas"]):
                text += f"=== Page {metadata['page']} ===\n{doc}\n\n"

            return text

        @tool
        def search_with_page_filter(
            query: str, start_page: int, end_page: int, k: int = 3
        ) -> str:
            """Search within a specific page range.

            Args:
                query: The search query
                start_page: Starting page number (inclusive)
                end_page: Ending page number (inclusive)
                k: Number of results to return

            Returns:
                Search results filtered by page range
            """
            # Get all results first
            results = self.vector_store.similarity_search(query, k=k * 3)

            # Filter by page range
            filtered = [
                res
                for res in results
                if start_page <= res.metadata.get("page", 0) <= end_page
            ][:k]

            if not filtered:
                return f"No results found in pages {start_page}-{end_page}."

            output = (
                f"Found {len(filtered)} results in pages {start_page}-{end_page}:\n\n"
            )
            for i, res in enumerate(filtered, 1):
                page = res.metadata.get("page", "unknown")
                content = (
                    res.page_content[:250] + "..."
                    if len(res.page_content) > 250
                    else res.page_content
                )
                output += f"{i}. [Page {page}]\n{content}\n\n"

            return output

        @tool
        def find_pages_by_keywords(keywords: list[str]) -> str:
            """Find page numbers that contain specific keywords.

            Args:
                keywords: List of keywords to search for

            Returns:
                List of page numbers containing the keywords
            """
            if not keywords:
                return "No keywords provided."

            # Search for each keyword
            all_pages = set()
            for keyword in keywords:
                results = self.vector_store.similarity_search(keyword, k=10)
                pages = [
                    res.metadata.get("page")
                    for res in results
                    if res.metadata.get("page")
                ]
                all_pages.update(pages)

            if not all_pages:
                return f"No pages found containing keywords: {keywords}"

            sorted_pages = sorted(list(all_pages))
            return f"Found {len(sorted_pages)} pages containing keywords {keywords}:\nPages: {sorted_pages}"

        return [
            semantic_search,
            get_document_pages,
            search_with_page_filter,
            find_pages_by_keywords,
        ]
