from .emart import EmartCrawler
from .homeplus import HomeplusCrawler
from .lottemart import LotteMartCrawler

CRAWLERS = [EmartCrawler(), LotteMartCrawler(), HomeplusCrawler()]

__all__ = ["CRAWLERS", "EmartCrawler", "LotteMartCrawler", "HomeplusCrawler"]
