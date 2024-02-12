export enum SearchEngine {
  Google = 'google',
  Bing = 'bing',
  DuckDuckGo = 'duckduckgo',
  Perplexity = 'perplexity',
  Exa = 'exa',
}

export const engineToTitle = {
  [SearchEngine.Google]: 'Google',
  [SearchEngine.Bing]: 'Bing',
  [SearchEngine.DuckDuckGo]: 'DuckDuckGo',
  [SearchEngine.Perplexity]: 'Perplexity',
  [SearchEngine.Exa]: 'Exa',
} satisfies Record<SearchEngine, string>

export const engineToShortcode = {
  [SearchEngine.Google]: 'gg',
  [SearchEngine.Bing]: 'bg',
  [SearchEngine.DuckDuckGo]: 'ddg',
  [SearchEngine.Perplexity]: 'pp',
  [SearchEngine.Exa]: 'ex',
} satisfies Record<SearchEngine, string>

export const engineToSearchUrl = {
  [SearchEngine.Google]: 'https://www.google.com/search?q=',
  [SearchEngine.Bing]: 'https://www.bing.com/search?q=',
  [SearchEngine.DuckDuckGo]: 'https://duckduckgo.com/?q=',
  [SearchEngine.Perplexity]: 'https://perplexity.ai/search?q=',
  [SearchEngine.Exa]: 'https://exa.ai/search?q=',
} satisfies Record<SearchEngine, string>
