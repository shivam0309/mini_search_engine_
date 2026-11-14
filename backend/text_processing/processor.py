"""M2 Text Processor: turns raw HTML into clean, stemmed words.

The same steps run on every page and on every query:
tokenize -> remove stop words -> stem. That is why a search for
"crawling" also finds pages that say "crawled" or "crawler".
"""

import re
from functools import lru_cache
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from nltk.stem import PorterStemmer

# Common English words that say little about what a page is about.
STOPWORDS = frozenset(
    """
    a about above after again against all am an and any are as at be because been before being below
    between both but by can could did do does doing down during each few for from further had has have
    having he her here hers herself him himself his how i if in into is it its itself just me more most
    my myself no nor not now of off on once only or other our ours ourselves out over own same she should
    so some such than that the their theirs them themselves then there these they this those through to
    too under until up very was we were what when where which while who whom why will with would you your
    yours yourself yourselves
    """.split()
)

# Parts of a page that are not its main content.
NOISE_TAGS = ["script", "style", "noscript", "template", "svg", "iframe", "form", "nav", "header", "footer", "aside"]
NOISE_CLASSES = ["navbox", "mw-editsection", "reflist", "references", "toc", "sidebar", "mw-jump-link", "noprint"]

_WORD = re.compile(r"[^\W_]+")  # letters and digits in any language
_stemmer = PorterStemmer()


def tokenize(text: str) -> list[str]:
    """Lower-case the text and split it into words."""
    return _WORD.findall(text.lower())


def is_stopword(word: str) -> bool:
    return word in STOPWORDS


@lru_cache(maxsize=200_000)
def stem(word: str) -> str:
    """Porter stem of one word, e.g. ranking -> rank. Cached because the same words repeat a lot."""
    return _stemmer.stem(word)


def remove_stopwords(tokens: list[str]) -> list[str]:
    return [t for t in tokens if t not in STOPWORDS]


def process(text: str) -> list[str]:
    """tokenize -> remove stop words -> stem."""
    return [stem(t) for t in remove_stopwords(tokenize(text))]


def extract(html: str, base_url: str = "") -> dict:
    """Read a page's title, visible text and links.

    Returns {"title": str, "text": str, "links": [absolute URLs]}.
    """
    soup = BeautifulSoup(html, "html.parser")

    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href and not href.startswith(("mailto:", "javascript:", "tel:", "#")):
            links.append(urljoin(base_url, href))

    title = ""
    h1 = soup.find("h1")
    if h1 and 0 < len(h1.get_text(strip=True)) <= 150:
        title = h1.get_text(" ", strip=True)
    elif soup.title and soup.title.string:
        title = soup.title.string.strip()

    for tag in soup.find_all(NOISE_TAGS):
        tag.decompose()
    for name in NOISE_CLASSES:
        for tag in soup.find_all(class_=name):
            tag.decompose()

    main = soup.find("main") or soup.find("article") or soup.find(id="content") or soup.body or soup
    text = re.sub(r"\s+", " ", main.get_text(" ", strip=True)).strip()
    if not title:
        title = text[:80]
    return {"title": title, "text": text, "links": links}
