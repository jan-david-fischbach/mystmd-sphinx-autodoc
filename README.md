# Sphinx demo with MyST-MD

1. Set up pathon environment `uv sync`
2. Install Node dependencies `uv run npm install`
3. Run Sphinx watch loop with `uv run npm run sphinx`
4. Run myst build loop with `uv run myst`

> [!WARNING]
> The `myst` application might not refresh on changes to the xrefs, as it caches
