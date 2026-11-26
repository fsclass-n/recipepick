from .emart import EmartCrawler
from .homeplus import HomeplusCrawler
from .lottemart import LotteMartCrawler
from .oimarket import OimarketCrawler

CRAWLERS = [EmartCrawler(), LotteMartCrawler(), HomeplusCrawler(), OimarketCrawler()]

__all__ = ["CRAWLERS", "EmartCrawler", "LotteMartCrawler", "HomeplusCrawler", "OimarketCrawler"]
